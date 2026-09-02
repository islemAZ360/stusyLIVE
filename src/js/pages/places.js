/* ============================================================
   Study Live — Places Page
   Yandex Maps engine (loaded on demand) with Leaflet/OSM
   fallback. Saved places live in the store (localStorage) and
   render as a searchable list: focus on the map / copy coords
   / open externally / edit / delete.
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var u = SL.utils;

  var engine = null;    // 'yandex' | 'leaflet'
  var map = null;       // engine instance
  var markerById = {};  // place id -> engine marker
  var loadToken = 0;    // guards async engine load vs re-render
  var filterQuery = ''; // saved-list search text
  var currentPlaces = [];

  function t(key, vars) {
    return SL.i18n.t(key, vars);
  }

  /* ---------- coordinates ---------- */

  function parseCoords(text) {
    if (!text) return null;
    var m = String(text)
      .replace(/[()]/g, '')
      .match(/(-?\d{1,3}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)/);
    if (!m) return null;
    var lat = parseFloat(m[1]);
    var lng = parseFloat(m[2]);
    if (isNaN(lat) || isNaN(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat: lat, lng: lng };
  }

  function fmt(p) {
    return p.lat.toFixed(5) + ', ' + p.lng.toFixed(5);
  }

  function copyText(text, done) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove();
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { done(true); },
        fallback
      );
    } else {
      fallback();
    }
  }

  function copyPlace(id) {
    var found =
      currentPlaces.filter(function (x) { return x.id === id; })[0] ||
      SL.store.places().filter(function (x) { return x.id === id; })[0];
    if (!found) return;
    copyText(fmt(found), function (ok) {
      if (ok) SL.ui.toast(t('pl.copied'));
      else SL.ui.toast(fmt(found));
    });
  }

  /* CSP-safe delegated copy button (works in Yandex balloons and
     Leaflet popups without any inline event handlers). */
  document.addEventListener('click', function (e) {
    var el = e.target;
    var btn = el && el.closest ? el.closest('[data-copy]') : null;
    if (btn) copyPlace(btn.getAttribute('data-copy'));
  });

  function externalUrl(p) {
    return 'https://yandex.com/maps/?pt=' + p.lng + ',' + p.lat + '&z=16';
  }

  /* ---------- map engines ---------- */

  var yandexPromise = null;

  function loadYandex() {
    if (root.ymaps && root.ymaps.Map) return Promise.resolve(root.ymaps);
    if (yandexPromise) return yandexPromise;
    yandexPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://api-maps.yandex.ru/2.1/?lang=' + (SL.i18n.lang || 'ar');
      s.async = true;
      var timer = setTimeout(function () {
        yandexPromise = null;
        reject(new Error('yandex-timeout'));
      }, 8000);
      s.onerror = function () {
        clearTimeout(timer);
        yandexPromise = null;
        reject(new Error('yandex-load'));
      };
      s.onload = function () {
        if (root.ymaps && root.ymaps.ready) {
          root.ymaps.ready(function () {
            clearTimeout(timer);
            if (root.ymaps.Map) resolve(root.ymaps);
            else reject(new Error('yandex-no-map'));
          });
        } else {
          clearTimeout(timer);
          yandexPromise = null;
          reject(new Error('yandex-missing'));
        }
      };
      document.head.appendChild(s);
    });
    return yandexPromise;
  }

  function destroyMap() {
    markerById = {};
    userMarker = null;
    pickMarker = null;
    if (!map) return;
    try {
      if (engine === 'yandex' && map.destroy) map.destroy();
      else if (map.remove) map.remove();
    } catch (e) {}
    map = null;
    engine = null;
  }

  function centerOf(places) {
    return places.length ? [places[0].lat, places[0].lng] : [24.7136, 46.6753];
  }

  function zoomFor(places) {
    return places.length ? (places.length > 1 ? 6 : 15) : 4;
  }

  function boundsOf(places) {
    var lats = places.map(function (p) { return p.lat; });
    var lngs = places.map(function (p) { return p.lng; });
    return [
      [Math.min.apply(null, lats), Math.min.apply(null, lngs)],
      [Math.max.apply(null, lats), Math.max.apply(null, lngs)],
    ];
  }

  function initMap(container, places) {
    destroyMap();
    currentPlaces = places.slice();
    var token = ++loadToken;

    loadYandex()
      .then(function (ymaps) {
        if (token !== loadToken || !container.isConnected) return;
        buildYandex(ymaps, container, places); // a throw here chains to .catch
      })
      .catch(function () {
        if (token !== loadToken || !container.isConnected) return;
        if (root.L) {
          buildLeaflet(container, places);
          SL.ui.toast(t('pl.mapOffline'));
        } else {
          showMapError(container);
        }
      });
  }

  function buildYandex(ymaps, container, places) {
    engine = 'yandex';
    map = new ymaps.Map(
      container,
      { center: centerOf(places), zoom: zoomFor(places), controls: ['zoomControl'] },
      { suppressMapOpenBlock: true }
    );

    // click on empty map -> pick a new place (ignore clicks on markers/balloons)
    map.events.add('click', function (e) {
      if (!map || e.get('target') !== map) return;
      var coords = e.get('coords');
      if (coords) handleMapPick({ lat: coords[0], lng: coords[1] });
    });

    places.forEach(function (p) {
      var pm = new ymaps.Placemark(
        [p.lat, p.lng],
        {},
        { preset: 'islands#circleDotIcon', iconColor: p.color || '#33589e', hasBalloon: false }
      );
      // tap a marker -> place details sheet (like regular map apps)
      pm.events.add('click', function () {
        showPlaceDetails(p);
      });
      map.geoObjects.add(pm);
      markerById[p.id] = pm;
    });

    if (places.length > 1) {
      map.setBounds(boundsOf(places), { checkZoomRange: true });
    }
  }

  /* Tap a saved place marker -> full details sheet.
     Implemented once here so Yandex and Leaflet behave identically. */
  function showPlaceDetails(p) {
    var body = document.createElement('div');
    body.className = 'sheet-form place-details';
    body.innerHTML =
      '<div class="place-details-head">' +
      '<span class="place-dot" style="--c:' + u.esc(p.color || '#33589e') + '"></span>' +
      '<span class="place-details-name">' + u.esc(p.name) + '</span>' +
      '</div>' +
      (p.desc ? '<p class="place-details-desc">' + u.esc(p.desc) + '</p>' : '') +
      '<button class="place-details-coords" data-act="copy" type="button" dir="ltr"' +
      ' title="' + u.esc(t('pl.copyCoords')) + '">' +
      SL.ui.icon('mapPin', 15) + '<span>' + fmt(p) + '</span></button>' +
      '<div class="sheet-actions place-details-actions">' +
      '<button class="btn btn-ghost" data-act="ext" type="button">' +
      SL.ui.icon('globe', 17) + '<span>' + u.esc(t('pl.openExt')) + '</span></button>' +
      '<button class="btn btn-ghost" data-act="edit" type="button">' +
      SL.ui.icon('pencil', 17) + '<span>' + u.esc(t('a.edit')) + '</span></button>' +
      '<button class="btn btn-danger" data-act="del" type="button">' +
      SL.ui.icon('trash', 17) + '<span>' + u.esc(t('a.delete')) + '</span></button>' +
      '</div>';

    var sheet = null;
    body.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = btn.getAttribute('data-act');
        if (a === 'copy') {
          copyPlace(p.id); // keep the sheet open after copying
          return;
        }
        sheet.close();
        if (a === 'ext') window.open(externalUrl(p), '_blank', 'noopener');
        else if (a === 'edit') openPlaceForm(p);
        else if (a === 'del') deletePlace(p);
      });
    });

    sheet = SL.ui.openSheet({
      title: p.name, // openSheet uses textContent — safe with any name
      body: body,
    });
  }

  /* OSM type -> localized category label (free, no API key) */
  var CATS = {
    ar: {
      cafe: 'مقهى', restaurant: 'مطعم', fast_food: 'وجبات سريعة', bar: 'بار', pub: 'حانة',
      bakery: 'مخبز', supermarket: 'سوبرماركت', convenience: 'بقالة', mall: 'مركز تجاري',
      pharmacy: 'صيدلية', hospital: 'مستشفى', clinic: 'عيادة', doctors: 'عيادة طبيب', dentist: 'عيادة أسنان',
      university: 'جامعة', college: 'كلية', school: 'مدرسة', kindergarten: 'روضة أطفال', library: 'مكتبة',
      museum: 'متحف', theatre: 'مسرح', cinema: 'سينما', arts_centre: 'مركز فنون',
      hotel: 'فندق', hostel: 'نزل', guest_house: 'بيت ضيافة', fuel: 'محطة وقود', charging_station: 'محطة شحن',
      parking: 'موقف سيارات', bank: 'بنك', atm: 'صراف آلي', gym: 'نادٍ رياضي', fitness_centre: 'نادٍ رياضي',
      sports_centre: 'مركز رياضي', stadium: 'ملعب', mosque: 'مسجد', church: 'كنيسة', synagogue: 'كنيس',
      park: 'حديقة', garden: 'حديقة', playground: 'ملعب أطفال', bus_stop: 'موقف باص', bus_station: 'محطة باص',
      station: 'محطة', subway: 'مترو', tram_stop: 'موقف ترام', police: 'شرطة', fire_station: 'حماية مدنية',
      post_office: 'مكتب بريد', hairdresser: 'صالون حلاقة', beauty: 'صالون تجميل', marketplace: 'سوق',
      attraction: 'معلم سياحي', viewpoint: 'نقطة إطلالة', monument: 'نصب تذكاري', castle: 'قلعة',
      zoo: 'حديقة حيوان', aquarium: 'أكواريوم', water_park: 'مدينة مائية', nightclub: 'نادٍ ليلي',
      bookstore: 'مكتبة كتب', car_repair: 'ورشة سيارات', laundry: 'مغسلة', veterinary: 'عيادة بيطرية',
      townhall: 'بلدية', courthouse: 'محكمة',
    },
    ru: {
      cafe: 'Кафе', restaurant: 'Ресторан', fast_food: 'Фастфуд', bar: 'Бар', pub: 'Паб',
      bakery: 'Пекарня', supermarket: 'Супермаркет', convenience: 'Магазин', mall: 'Торговый центр',
      pharmacy: 'Аптека', hospital: 'Больница', clinic: 'Клиника', doctors: 'Врач', dentist: 'Стоматология',
      university: 'Университет', college: 'Колледж', school: 'Школа', kindergarten: 'Детский сад', library: 'Библиотека',
      museum: 'Музей', theatre: 'Театр', cinema: 'Кинотеатр', arts_centre: 'Центр искусств',
      hotel: 'Отель', hostel: 'Хостел', guest_house: 'Гостевой дом', fuel: 'АЗС', charging_station: 'Зарядная станция',
      parking: 'Парковка', bank: 'Банк', atm: 'Банкомат', gym: 'Спортзал', fitness_centre: 'Спортзал',
      sports_centre: 'Спортцентр', stadium: 'Стадион', mosque: 'Мечеть', church: 'Церковь', synagogue: 'Синагога',
      park: 'Парк', garden: 'Сад', playground: 'Детская площадка', bus_stop: 'Остановка', bus_station: 'Автостанция',
      station: 'Вокзал', subway: 'Метро', tram_stop: 'Трамвайная остановка', police: 'Полиция', fire_station: 'Пожарная часть',
      post_office: 'Почта', hairdresser: 'Парикмахерская', beauty: 'Салон красоты', marketplace: 'Рынок',
      attraction: 'Достопримечательность', viewpoint: 'Смотровая площадка', monument: 'Памятник', castle: 'Крепость',
      zoo: 'Зоопарк', aquarium: 'Океанариум', water_park: 'Аквапарк', nightclub: 'Ночной клуб',
      bookstore: 'Книжный магазин', car_repair: 'Автосервис', laundry: 'Прачечная', veterinary: 'Ветклиника',
      townhall: 'Мэрия', courthouse: 'Суд',
    },
    en: {
      cafe: 'Cafe', restaurant: 'Restaurant', fast_food: 'Fast food', bar: 'Bar', pub: 'Pub',
      bakery: 'Bakery', supermarket: 'Supermarket', convenience: 'Convenience store', mall: 'Shopping mall',
      pharmacy: 'Pharmacy', hospital: 'Hospital', clinic: 'Clinic', doctors: 'Doctor', dentist: 'Dentist',
      university: 'University', college: 'College', school: 'School', kindergarten: 'Kindergarten', library: 'Library',
      museum: 'Museum', theatre: 'Theatre', cinema: 'Cinema', arts_centre: 'Arts centre',
      hotel: 'Hotel', hostel: 'Hostel', guest_house: 'Guest house', fuel: 'Fuel station', charging_station: 'Charging station',
      parking: 'Parking', bank: 'Bank', atm: 'ATM', gym: 'Gym', fitness_centre: 'Gym',
      sports_centre: 'Sports centre', stadium: 'Stadium', mosque: 'Mosque', church: 'Church', synagogue: 'Synagogue',
      park: 'Park', garden: 'Garden', playground: 'Playground', bus_stop: 'Bus stop', bus_station: 'Bus station',
      station: 'Station', subway: 'Metro', tram_stop: 'Tram stop', police: 'Police', fire_station: 'Fire station',
      post_office: 'Post office', hairdresser: 'Hairdresser', beauty: 'Beauty salon', marketplace: 'Market',
      attraction: 'Attraction', viewpoint: 'Viewpoint', monument: 'Monument', castle: 'Castle',
      zoo: 'Zoo', aquarium: 'Aquarium', water_park: 'Water park', nightclub: 'Nightclub',
      bookstore: 'Bookstore', car_repair: 'Car repair', laundry: 'Laundry', veterinary: 'Veterinary',
      townhall: 'Town hall', courthouse: 'Courthouse',
    },
  };

  function catLabel(type) {
    var d = CATS[SL.i18n.lang] || CATS.en;
    if (d[type]) return d[type];
    return String(type).replace(/_/g, ' ');
  }

  var geoCache = {};

  /* Nominatim reverse: name / address / opening_hours / phone / website */
  function reverseGeocode(c) {
    var key = c.lat.toFixed(4) + ',' + c.lng.toFixed(4);
    if (geoCache[key]) return Promise.resolve(geoCache[key]);
    var url =
      'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18' +
      '&addressdetails=1&extratags=1' +
      '&accept-language=' + encodeURIComponent(SL.i18n.lang || 'en') +
      '&lat=' + c.lat + '&lon=' + c.lng;
    return fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (d) { geoCache[key] = d; return d; });
  }

  /* Wikimedia Commons geosearch: nearby photos (free, CORS ok) */
  function commonsPhotos(c) {
    var url =
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
      '&generator=geosearch&ggsradius=100&ggslimit=12' +
      '&prop=imageinfo&iiprop=url&iiurlwidth=360' +
      '&ggscoord=' + encodeURIComponent(c.lat + '|' + c.lng);
    return fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (d) {
        var pages = d && d.query && d.query.pages ? d.query.pages : {};
        var out = [];
        Object.keys(pages).forEach(function (k) {
          var info = pages[k].imageinfo && pages[k].imageinfo[0];
          if (info && info.thumburl && /\.(jpe?g|png)$/i.test(info.thumburl)) {
            out.push({ thumb: info.thumburl, full: info.url || info.thumburl });
          }
        });
        return out.slice(0, 8);
      })
      .catch(function () { return []; });
  }

  /* Tile providers, tried in order: a dark theme first (matches the
     app), then classic OSM raster. If every provider fails (blocked
     network, aggressive ad-blocker...) we show an explicit error card
     with a retry button instead of a silent empty gray box. */
  var TILE_PROVIDERS = [
    {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      opts: {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap &copy; CARTO',
      },
    },
    {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      opts: { maxZoom: 19, attribution: '&copy; OpenStreetMap' },
    },
  ];

  function showMapError(container) {
    container.innerHTML =
      '<div class="places-map-error">' +
      '<div class="icon-wrap">' + SL.ui.icon('mapPin', 30) + '</div>' +
      '<p>' + u.esc(t('pl.mapError')) + '</p>' +
      '<button type="button" class="btn btn-ghost" id="pl-map-retry">' +
      u.esc(t('pl.retry')) + '</button>' +
      '</div>';
    var retry = container.querySelector('#pl-map-retry');
    if (retry) {
      retry.addEventListener('click', function () {
        container.innerHTML = '';
        initMap(container, currentPlaces);
      });
    }
  }

  function addTilesWithFallback(onAllFailed) {
    var idx = 0;

    function tryNext() {
      if (idx >= TILE_PROVIDERS.length || !map) {
        onAllFailed();
        return;
      }
      var cfg = TILE_PROVIDERS[idx++];
      var layer = L.tileLayer(cfg.url, cfg.opts);
      var settled = false;
      var timer = setTimeout(fail, 12000);

      function fail() {
        if (settled || !map) return;
        settled = true;
        clearTimeout(timer);
        try { map.removeLayer(layer); } catch (e) {}
        tryNext();
      }

      layer.on('tileload', function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
      });
      layer.on('tileerror', fail);
      layer.addTo(map);
    }

    tryNext();
  }

  function buildLeaflet(container, places) {
    engine = 'leaflet';
    map = L.map(container, { zoomControl: true }).setView(centerOf(places), zoomFor(places));

    // click on empty map -> pick a new place (markers stop propagation)
    map.on('click', function (e) {
      handleMapPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    addTilesWithFallback(function () {
      destroyMap();
      showMapError(container);
    });

    places.forEach(function (p) {
      var m = L.circleMarker([p.lat, p.lng], {
        radius: 9,
        fillColor: p.color || '#33589e',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95,
      }).addTo(map);
      // tap a marker -> place details sheet
      m.on('click', function () {
        showPlaceDetails(p);
      });
      markerById[p.id] = m;
    });

    if (places.length > 1) {
      map.fitBounds(
        L.latLngBounds(places.map(function (p) { return [p.lat, p.lng]; })).pad(0.25)
      );
    }

    // the router may reveal the card after init — recalc size so tiles align
    setTimeout(function () {
      if (map && map.invalidateSize) map.invalidateSize();
    }, 150);
  }

  function focusPlace(p) {
    if (!map || !p) return;
    var coords = [p.lat, p.lng];
    if (engine === 'yandex') {
      map.setCenter(coords, 16, { checkZoomRange: true });
    } else if (engine === 'leaflet') {
      map.flyTo(coords, 16, { duration: 0.6 });
    }
    var card = document.querySelector('.places-map-card');
    if (card && card.scrollIntoView) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ---------- pick a spot by clicking the map ---------- */

  var pickMarker = null; // temporary marker for a clicked (not yet saved) spot

  function clearPickMarker() {
    if (!pickMarker || !map) return;
    try {
      if (engine === 'yandex') map.geoObjects.remove(pickMarker);
      else if (map.removeLayer) map.removeLayer(pickMarker);
    } catch (e) {}
    pickMarker = null;
  }

  function showPickMarker(c) {
    if (!map) return;
    clearPickMarker();
    try {
      if (engine === 'yandex' && root.ymaps) {
        pickMarker = new root.ymaps.Placemark(
          [c.lat, c.lng],
          { balloonContentBody: '<span dir="ltr">' + fmt(c) + '</span>' },
          { preset: 'islands#yellowDotIcon', iconColor: '#f5a623' }
        );
        map.geoObjects.add(pickMarker);
        map.panTo([c.lat, c.lng]);
      } else if (engine === 'leaflet' && root.L) {
        pickMarker = L.circleMarker([c.lat, c.lng], {
          radius: 9,
          fillColor: '#f5a623',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 1,
        }).addTo(map);
        pickMarker
          .bindPopup(
            '<b>' + u.esc(t('pl.picked')) + '</b><br><span dir="ltr">' + fmt(c) + '</span>'
          )
          .openPopup();
      }
    } catch (e) {}
  }

  function handleMapPick(c) {
    if (!c) return;
    showPickMarker(c);
    showMapPlaceDetails(c);
  }

  var detailsSeq = 0;

  /* Tap anywhere on the map -> sheet with REAL place info:
     name, category, address, hours, phone, website, nearby photos,
     then optional "save to my places". */
  function showMapPlaceDetails(c) {
    var body = document.createElement('div');
    body.className = 'sheet-form place-details';
    body.innerHTML =
      '<div class="place-loading">' + u.esc(t('pl.loadingDetails')) + '</div>';

    function render(data, photos) {
      if (sheet.closed) return;
      var extra = (data && data.extratags) || {};
      var name = (data && data.name) || '';
      var cat = data && data.type ? catLabel(data.type) : '';
      var a = (data && data.address) || {};
      var addr = [a.road, a.house_number, a.neighbourhood, a.suburb,
        a.city || a.town || a.village, a.postcode].filter(Boolean).join(', ');
      var esc = u.esc;

      if (name) {
        body.innerHTML =
          '<div class="place-details-head">' +
          '<span class="place-dot" style="--c:var(--accent)"></span>' +
          '<span class="place-details-name">' + esc(name) + '</span></div>' +
          (cat ? '<div class="place-poi-cat">' + esc(cat) + '</div>' : '');
      } else {
        body.innerHTML =
          '<div class="place-details-head">' +
          '<span class="place-dot" style="--c:var(--accent)"></span>' +
          '<span class="place-details-name" dir="ltr">' + fmt(c) + '</span></div>' +
          '<div class="place-poi-note">' + esc(t('pl.noDetails')) + '</div>';
      }

      var rows = '';
      function addRow(label, valueHtml, href) {
        rows += href
          ? '<a class="place-poi-row" href="' + href + '"' +
            (href.indexOf('tel:') === 0 ? '' : ' target="_blank" rel="noopener"') +
            '><span class="lbl">' + esc(label) + '</span><span class="val">' + valueHtml + '</span></a>'
          : '<div class="place-poi-row"><span class="lbl">' + esc(label) +
            '</span><span class="val">' + valueHtml + '</span></div>';
      }
      if (addr) addRow(t('pl.addr'), esc(addr));
      if (extra.opening_hours) addRow(t('pl.hours'), esc(extra.opening_hours));
      var phone = extra.phone || extra['contact:phone'];
      if (phone) addRow(t('pl.phone'), esc(phone), 'tel:' + esc(String(phone).replace(/[^\d+]/g, '')));
      var web = extra.website || extra['contact:website'];
      if (web) {
        addRow(t('pl.web'),
          esc(String(web).replace(/^https?:\/\//, '').replace(/\/$/, '')),
          esc(String(web)));
      }
      if (rows) body.innerHTML += '<div class="place-poi-rows">' + rows + '</div>';

      body.innerHTML += photos.length
        ? '<div class="place-poi-photos">' +
          photos.map(function (ph) {
            return '<img class="place-poi-photo" src="' + esc(ph.thumb) +
              '" alt="" loading="lazy" data-full="' + esc(ph.full) + '">';
          }).join('') + '</div>'
        : '<div class="place-poi-note">' + esc(t('pl.noPhotos')) + '</div>';

      body.innerHTML +=
        '<div class="sheet-actions place-details-actions">' +
        '<button class="btn btn-primary" data-act="save" type="button">' +
        u.esc(t('pl.saveMyPlaces')) + '</button>' +
        '<button class="btn btn-ghost" data-act="copy" type="button">' +
        u.esc(t('pl.copyCoords')) + '</button>' +
        '<button class="btn btn-ghost" data-act="ext" type="button">' +
        u.esc(t('pl.openExt')) + '</button></div>';

      body.querySelector('[data-act="save"]').addEventListener('click', function () {
        sheet.close();
        openPlaceForm(null, { lat: c.lat, lng: c.lng, name: name, desc: cat });
      });
      body.querySelector('[data-act="copy"]').addEventListener('click', function () {
        copyText(fmt(c), function (ok) {
          if (ok) SL.ui.toast(t('pl.copied'));
          else SL.ui.toast(fmt(c));
        });
      });
      body.querySelector('[data-act="ext"]').addEventListener('click', function () {
        window.open(externalUrl(c), '_blank', 'noopener');
      });
      body.querySelectorAll('.place-poi-photo').forEach(function (img) {
        img.addEventListener('click', function () {
          window.open(img.getAttribute('data-full'), '_blank', 'noopener');
        });
      });
    }

    var seq = ++detailsSeq;
    var sheet = SL.ui.openSheet({ title: t('pl.details'), body: body });
    Promise.all([
      reverseGeocode(c).catch(function () { return null; }),
      commonsPhotos(c),
    ]).then(function (res) {
      if (seq !== detailsSeq || sheet.closed) return;
      render(res[0], res[1]);
    });
  }

  /* ---------- my location on the map ---------- */

  var userMarker = null; // engine marker for "you are here"

  function gpsErrorKey(err) {
    if (err) {
      if (err.code === 1) return 'pl.gpsDenied';
      if (err.code === 2) return 'pl.gpsUnavailable';
      if (err.code === 3) return 'pl.gpsTimeout';
    }
    return 'pl.gpsError';
  }

  function showUserOnMap(fix) {
    if (!map) return;

    if (engine === 'yandex' && root.ymaps) {
      if (userMarker) {
        try { map.geoObjects.remove(userMarker); } catch (e) {}
      }
      userMarker = new root.ymaps.Placemark(
        [fix.lat, fix.lng],
        { balloonContentBody: '<span dir="ltr">' + fmt(fix) + '</span>' },
        { preset: 'islands#redCircleDotIcon', iconColor: '#e53935' }
      );
      map.geoObjects.add(userMarker);
      map.setCenter([fix.lat, fix.lng], Math.max(map.getZoom() || 0, 15));
    } else if (engine === 'leaflet' && root.L) {
      if (userMarker) {
        try { map.removeLayer(userMarker); } catch (e) {}
        userMarker = null;
      }
      var group = L.layerGroup();
      if (fix.acc > 25) {
        L.circle([fix.lat, fix.lng], {
          radius: fix.acc,
          color: '#e53935',
          weight: 1,
          fillColor: '#e53935',
          fillOpacity: 0.1,
        }).addTo(group);
      }
      L.circleMarker([fix.lat, fix.lng], {
        radius: 8,
        fillColor: '#e53935',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 1,
      }).addTo(group).bindPopup('<b>' + u.esc(t('pl.located')) + '</b><br><span dir="ltr">' + fmt(fix) + '</span>');
      group.addTo(map);
      userMarker = group;
      map.flyTo([fix.lat, fix.lng], 15, { duration: 0.8 });
    }

    var card = document.querySelector('.places-map-card');
    if (card && card.scrollIntoView) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function locateMe() {
    var btn = document.getElementById('pl-locate');
    if (!map || !btn) return;
    if (!navigator.geolocation || !navigator.geolocation.getCurrentPosition) {
      SL.ui.toast(t('pl.gpsUnsupported'), 'error');
      return;
    }
    btn.classList.add('loading');
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        btn.classList.remove('loading');
        btn.disabled = false;
        showUserOnMap({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy || 0,
        });
      },
      function (err) {
        btn.classList.remove('loading');
        btn.disabled = false;
        SL.ui.toast(t(gpsErrorKey(err)), 'error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  /* ---------- add / edit form ---------- */

  function geocode(q, lang) {
    var url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=5' +
      '&accept-language=' + encodeURIComponent(lang) +
      '&q=' + encodeURIComponent(q);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('http');
      return r.json();
    });
  }

  function openPlaceForm(existing, pick) {
    var isEdit = !!existing;
    var p = existing || {
      name: (pick && pick.name) || '',
      desc: (pick && pick.desc) || '',
      lat: pick ? +pick.lat.toFixed(6) : '',
      lng: pick ? +pick.lng.toFixed(6) : '',
      color: '#33589e',
    };

    var PALETTE = [
      '#33589e', '#7b4bc9', '#00838f', '#2e7d32',
      '#c62828', '#e07b1f', '#ad1457', '#5d4037',
    ];
    var currentColor = p.color || '#33589e';
    var isPresetColor = PALETTE.some(function (c) {
      return c.toLowerCase() === currentColor.toLowerCase();
    });
    var swatches = PALETTE.map(function (c) {
      return (
        '<button type="button" class="swatch' +
        (c.toLowerCase() === currentColor.toLowerCase() ? ' selected' : '') +
        '" data-color="' + c + '" style="--sw:' + c + '" aria-label="' + c + '"></button>'
      );
    }).join('');

    var body = document.createElement('div');
    body.className = 'sheet-form place-form';
    body.innerHTML =
      '<div class="field"><label>' + u.esc(t('pl.name')) + '</label>' +
      '<input class="input" type="text" id="pl-name" placeholder="' + u.esc(t('pl.namePh')) + '" value="' + u.esc(p.name) + '"></div>' +

      '<div class="field"><label>' + u.esc(t('pl.desc')) + '</label>' +
      '<textarea class="textarea place-desc" id="pl-desc" rows="3" placeholder="' + u.esc(t('pl.descPh')) + '">' + u.esc(p.desc) + '</textarea></div>' +

      '<div class="field"><label>' + u.esc(t('pl.searchLabel')) + '</label>' +
      '<input class="input" type="search" id="pl-search" placeholder="' + u.esc(t('pl.searchPh')) + '" autocomplete="off">' +
      '<div id="pl-results"></div>' +
      '<div id="pl-status" class="geo-status"></div></div>' +

      '<div class="place-coords-row">' +
      '<div class="field"><label dir="ltr">' + u.esc(t('pl.lat')) + '</label>' +
      '<input class="input" dir="ltr" type="number" step="any" id="pl-lat" placeholder="24.7136" value="' + p.lat + '"></div>' +
      '<div class="field"><label dir="ltr">' + u.esc(t('pl.lng')) + '</label>' +
      '<input class="input" dir="ltr" type="number" step="any" id="pl-lng" placeholder="46.6753" value="' + p.lng + '"></div>' +
      '</div>' +

      '<button class="btn btn-ghost btn-block place-gps-btn" id="pl-gps-btn" type="button">' +
      SL.ui.icon('navigate', 18) + ' ' + u.esc(t('pl.useGps')) + '</button>' +

      '<div class="field place-color-field"><label>' + u.esc(t('pl.color')) + '</label>' +
      '<div class="place-swatches">' + swatches +
      '<label class="swatch swatch-custom' + (isPresetColor ? '' : ' selected') + '" style="--sw:' + u.esc(currentColor) + '" title="' + u.esc(t('pl.color')) + '">' +
      '<input type="color" id="pl-color" value="' + u.esc(currentColor) + '"></label>' +
      '</div></div>' +

      '<div class="sheet-actions"><button class="btn btn-primary btn-block" id="pl-save">' +
      u.esc(t('a.save')) + '</button></div>';

    /* color swatches keep the hidden color input in sync */
    var colorInput = body.querySelector('#pl-color');
    body.querySelectorAll('.place-swatches .swatch').forEach(function (sw) {
      sw.addEventListener('click', function (e) {
        if (e.target === colorInput) return;
        var c = sw.getAttribute('data-color');
        if (c) colorInput.value = c;
        colorInput.closest('.swatch').style.setProperty('--sw', colorInput.value);
        body.querySelectorAll('.place-swatches .swatch').forEach(function (x) {
          x.classList.toggle('selected', x === sw);
        });
      });
    });
    colorInput.addEventListener('input', function () {
      colorInput.closest('.swatch').style.setProperty('--sw', colorInput.value);
    });

    var nameInput = body.querySelector('#pl-name');
    var searchInput = body.querySelector('#pl-search');
    var resultsBox = body.querySelector('#pl-results');
    var statusEl = body.querySelector('#pl-status');
    var latInput = body.querySelector('#pl-lat');
    var lngInput = body.querySelector('#pl-lng');
    var timer = null;
    var searchSeq = 0;

    function applyCoords(lat, lng, displayName) {
      latInput.value = lat.toFixed(6);
      lngInput.value = lng.toFixed(6);
      if (displayName && !nameInput.value.trim()) nameInput.value = displayName;
    }

    /* ==== SEARCH WIRING ==== */

    /* pasted coordinates ("24.71, 46.67") win instantly — no network */
    function showParsed() {
      var c = parseCoords(searchInput.value);
      if (!c) return false;
      statusEl.textContent = '';
      resultsBox.innerHTML =
        '<div class="geo-results"><button type="button" class="geo-result">' +
        SL.ui.icon('mapPin', 16) +
        '<span><span dir="ltr">' + fmt(c) + '</span> — ' + u.esc(t('pl.parsed')) + '</span>' +
        '</button></div>';
      resultsBox.querySelector('.geo-result').addEventListener('click', function () {
        applyCoords(c.lat, c.lng);
        resultsBox.innerHTML = '';
        searchInput.value = '';
      });
      return true;
    }

    function runSearch() {
      if (showParsed()) return;
      var q = searchInput.value.trim();
      if (q.length < 3) {
        resultsBox.innerHTML = '';
        statusEl.textContent = '';
        return;
      }
      var seq = ++searchSeq;
      statusEl.textContent = t('pl.searching');
      geocode(q, SL.i18n.lang || 'en')
        .then(function (list) {
          if (seq !== searchSeq) return; // stale response
          statusEl.textContent = list && list.length ? '' : t('pl.noResults');
          resultsBox.innerHTML = '';
          if (!list || !list.length) return;
          var wrap = document.createElement('div');
          wrap.className = 'geo-results';
          list.forEach(function (r) {
            var lat = parseFloat(r.lat);
            var lng = parseFloat(r.lon);
            var label = (r.display_name || '').split(',').slice(0, 3).join(', ');
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'geo-result';
            b.innerHTML = SL.ui.icon('mapPin', 16) + '<span>' + u.esc(label) + '</span>';
            b.addEventListener('click', function () {
              applyCoords(lat, lng, (r.display_name || '').split(',')[0]);
              resultsBox.innerHTML = '';
              statusEl.textContent = '';
              searchInput.value = label;
            });
            wrap.appendChild(b);
          });
          resultsBox.appendChild(wrap);
        })
        .catch(function () {
          if (seq !== searchSeq) return;
          statusEl.textContent = t('pl.searchFail');
        });
    }

    searchInput.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(runSearch, 550);
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(timer);
        runSearch();
      }
    });

    body.querySelector('#pl-gps-btn').addEventListener('click', function () {
      var gpsBtn = body.querySelector('#pl-gps-btn');
      if (!navigator.geolocation || !navigator.geolocation.getCurrentPosition) {
        SL.ui.toast(t('pl.gpsUnsupported'), 'error');
        return;
      }
      gpsBtn.disabled = true;
      statusEl.textContent = t('pl.locating');
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          gpsBtn.disabled = false;
          statusEl.textContent = '';
          applyCoords(pos.coords.latitude, pos.coords.longitude);
          SL.ui.toast(t('pl.gpsDone'));
        },
        function (err) {
          gpsBtn.disabled = false;
          statusEl.textContent = '';
          var key = 'pl.gpsError';
          if (err) {
            if (err.code === 1) key = 'pl.gpsDenied';
            else if (err.code === 2) key = 'pl.gpsUnavailable';
            else if (err.code === 3) key = 'pl.gpsTimeout';
          }
          SL.ui.toast(t(key), 'error');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    });

    /* ==== SAVE ==== */

    body.querySelector('#pl-save').addEventListener('click', function () {
      var name = nameInput.value.trim();
      var lat = parseFloat(latInput.value);
      var lng = parseFloat(lngInput.value);
      if (!name) {
        SL.ui.toast(t('pl.nameRequired'), 'error');
        nameInput.focus();
        return;
      }
      if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        SL.ui.toast(t('pl.latLngRequired'), 'error');
        latInput.focus();
        return;
      }
      var data = {
        name: name,
        desc: body.querySelector('#pl-desc').value.trim(),
        lat: lat,
        lng: lng,
        color: body.querySelector('#pl-color').value,
      };
      if (isEdit) SL.store.updatePlace(p.id, data);
      else SL.store.addPlace(data);
      sheet.close();
      SL.router.refresh();
    });

    var sheet = SL.ui.openSheet({
      title: t(isEdit ? 'pl.editTitle' : 'pl.add'),
      body: body,
      autofocus: false,
      onClose: clearPickMarker, // drop the orange pin if the form is dismissed
    });
    if (pick) nameInput.focus();
    else searchInput.focus();
  }

  /* ---------- delete ---------- */

  function deletePlace(p) {
    SL.ui.confirmSheet({
      title: t('pl.deleteQ', { name: p.name }),
      danger: true,
    }).then(function (yes) {
      if (yes) {
        SL.store.deletePlace(p.id);
        SL.router.refresh();
      }
    });
  }

  /* ---------- page ---------- */

  function cardHtml(p) {
    return (
      '<div class="place-card" data-id="' + p.id + '" role="button" tabindex="0"' +
      ' aria-label="' + u.esc(p.name) + '">' +
      '<span class="place-dot" style="--c:' + u.esc(p.color || '#33589e') + '"></span>' +
      '<div class="place-info">' +
      '<span class="place-name">' + u.esc(p.name) + '</span>' +
      (p.desc ? '<span class="place-desc">' + u.esc(p.desc) + '</span>' : '') +
      '<button class="place-coords" data-act="copy" type="button" dir="ltr"' +
      ' title="' + u.esc(t('pl.copyCoords')) + '">' + fmt(p) + '</button>' +
      '</div>' +
      '<div class="place-actions">' +
      '<button class="icon-btn" data-act="view" type="button" title="' + u.esc(t('pl.view')) + '">' +
      SL.ui.icon('navigate', 17) + '</button>' +
      '<button class="icon-btn" data-act="ext" type="button" title="' + u.esc(t('pl.openExt')) + '">' +
      SL.ui.icon('globe', 17) + '</button>' +
      '<button class="icon-btn" data-act="edit" type="button" title="' + u.esc(t('a.edit')) + '">' +
      SL.ui.icon('pencil', 17) + '</button>' +
      '<button class="icon-btn danger" data-act="del" type="button" title="' + u.esc(t('a.delete')) + '">' +
      SL.ui.icon('trash', 17) + '</button>' +
      '</div></div>'
    );
  }

  function renderList(rootEl, all) {
    var q = filterQuery.trim().toLowerCase();
    var places = !q
      ? all
      : all.filter(function (p) {
          var hay = (p.name + ' ' + (p.desc || '') + ' ' + fmt(p)).toLowerCase();
          return hay.indexOf(q) !== -1;
        });

    var countEl = rootEl.querySelector('#pl-count');
    var listEl = rootEl.querySelector('#pl-list');
    if (countEl) countEl.textContent = t('pl.count', { n: places.length });
    if (!listEl) return;

    if (!places.length) {
      listEl.innerHTML = q
        ? '<div class="empty-state"><p>' + u.esc(t('pl.noResults')) + '</p></div>'
        : '<div class="empty-state stagger"><div class="icon-wrap">' +
          SL.ui.icon('mapPin', 32) + '</div>' +
          '<p>' + u.esc(t('pl.noPlaces')) + '</p></div>';
      return;
    }

    listEl.innerHTML = places.map(cardHtml).join('');

    listEl.querySelectorAll('.place-card').forEach(function (card) {
      var id = card.getAttribute('data-id');
      var place = all.filter(function (x) { return x.id === id; })[0];

      card.addEventListener('click', function () {
        if (place) focusPlace(place);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (place) focusPlace(place);
        }
      });

      card.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          if (!place) return;
          var a = btn.getAttribute('data-act');
          if (a === 'copy') copyPlace(place.id);
          else if (a === 'view') focusPlace(place);
          else if (a === 'ext') window.open(externalUrl(place), '_blank', 'noopener');
          else if (a === 'edit') openPlaceForm(place);
          else if (a === 'del') deletePlace(place);
        });
      });
    });
  }

  SL.pages = SL.pages || {};
  SL.pages.places = {
    id: 'places',
    labelKey: 'nav.places',
    icon: 'mapPin',
    getFab: function () {
      return {
        labelKey: 'pl.add',
        action: function () {
          openPlaceForm(null);
        },
      };
    },
    render: function (rootEl) {
      var all = SL.store.places();

      rootEl.innerHTML =
        '<header class="page-head">' +
        '<h1><div class="icon-wrap">' + SL.ui.icon('mapPin', 24) + '</div><span>' +
        u.esc(t('nav.places')) + '</span></h1>' +
        '</header>' +
        '<div class="page-content">' +
        '<div class="places-map-card stagger">' +
        '<div id="places-map-embed" class="places-map"></div>' +
        '<button id="pl-locate" class="places-locate-btn" type="button" title="' +
        u.esc(t('pl.locate')) + '" aria-label="' + u.esc(t('pl.locate')) + '">' +
        SL.ui.icon('navigate', 20) + '</button>' +
        '<div class="places-map-hint">' + SL.ui.icon('mapPin', 14) +
        '<span>' + u.esc(t('pl.mapPickHint')) + '</span></div>' +
        '</div>' +
        '<div class="places-toolbar"><div class="places-search">' +
        SL.ui.icon('search', 18) +
        '<input id="pl-filter" type="search" placeholder="' + u.esc(t('pl.filterPh')) +
        '" value="' + u.esc(filterQuery) + '" autocomplete="off">' +
        '<button id="pl-filter-clear" class="places-clear" type="button" aria-label="' +
        u.esc(t('a.close')) + '"' + (filterQuery ? '' : ' hidden') + '>' +
        SL.ui.icon('x', 16) + '</button>' +
        '</div></div>' +
        '<div class="places-count" id="pl-count"></div>' +
        '<div class="places-list" id="pl-list"></div>' +
        '</div>';

      renderList(rootEl, all);

      var filterInput = rootEl.querySelector('#pl-filter');
      var clearBtn = rootEl.querySelector('#pl-filter-clear');
      filterInput.addEventListener('input', function () {
        filterQuery = filterInput.value;
        clearBtn.hidden = !filterQuery;
        renderList(rootEl, all); // re-render the list only — the map stays alive
      });
      clearBtn.addEventListener('click', function () {
        filterQuery = '';
        filterInput.value = '';
        clearBtn.hidden = true;
        renderList(rootEl, all);
        filterInput.focus();
      });

      var mapEl = rootEl.querySelector('#places-map-embed');
      setTimeout(function () {
        initMap(mapEl, all);
      }, 60);

      rootEl.querySelector('#pl-locate').addEventListener('click', locateMe);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);