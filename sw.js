!function(e){var t={};function n(r){if(t[r])return t[r].exports;var i=t[r]={i:r,l:!1,exports:{}};return e[r].call(i.exports,i,i.exports,n),i.l=!0,i.exports}n.m=e,n.c=t,n.d=function(e,t,r){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:r})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var r=Object.create(null);if(n.r(r),Object.defineProperty(r,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var i in e)n.d(r,i,function(t){return e[t]}.bind(null,i));return r},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=0)}([function(e,t,n){"use strict";Object.defineProperty(t,"__esModule",{value:!0});const r=n(1);self.EasyPwaSW=new r.default},function(e,t,n){"use strict";Object.defineProperty(t,"__esModule",{value:!0});t.default=class{constructor(){this.sw=self,this.initSkipWaiting()}initSkipWaiting(){this.sw.addEventListener("message",e=>{"skipWaiting"===e.data&&skipWaiting()})}}}]);
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('my-cache-v1').then((cache) => {
      console.log('Сайт кеширован');
      return cache.addAll([
        '/offline.html'  // Кэшируем только страницу оффлайн
      ]).catch((err) => {
        console.error('Ошибка при кешировании:', err);
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Проверяем, является ли запрос запросом формы (например, POST-запросы)
  if (event.request.method === 'POST') {
    // Не обрабатываем POST-запросы через сервис-воркер, чтобы они не приводили к ошибке
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Если запрос успешный, возвращаем его
        if (response && response.status === 200) {
          return response;
        }
        // Если ошибка при запросе, проверяем кеш
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Если это запрос страницы и нет ответа, возвращаем оффлайн страницу
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');  // Возвращаем страницу оффлайн
          }
          // Для других типов запросов возвращаем ошибку или ничего
          return Promise.reject('No cached response or network response');
        });
      })
      .catch(() => {
        // Если нет сети, возвращаем страницу оффлайн
        return caches.match('/offline.html');
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = ['my-cache-v1'];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);  // Удаляем устаревшие кеши
          }
        })
      );
    })
  );
});

self.addEventListener('install', event => {
  event.waitUntil(
      caches.open('easyPWA-cache').then(cache => {
          return cache.addAll([
              '/',
              '/index.html',
              '/styles.css',
              '/script.js',
              '/images/icon.png'
          ]);
      })
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Новое уведомление';
  const options = {
      body: data.body || 'У вас новое событие!',
      icon: 'images/icon.png',
      badge: 'images/badge.png',
  };

  event.waitUntil(
      self.registration.showNotification(title, options)
  );
});

