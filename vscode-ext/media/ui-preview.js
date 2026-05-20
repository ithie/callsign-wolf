"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // ../node_modules/@capacitor/core/dist/index.js
  var ExceptionCode, CapacitorException, getPlatformId, createCapacitor, initCapacitorGlobal, Capacitor, registerPlugin, WebPlugin, encode, decode, CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64, normalizeHttpHeaders, buildUrlParams, buildRequestInit, CapacitorHttpPluginWeb, CapacitorHttp, SystemBarsStyle, SystemBarType, SystemBarsPluginWeb, SystemBars;
  var init_dist = __esm({
    "../node_modules/@capacitor/core/dist/index.js"() {
      "use strict";
      (function(ExceptionCode2) {
        ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
        ExceptionCode2["Unavailable"] = "UNAVAILABLE";
      })(ExceptionCode || (ExceptionCode = {}));
      CapacitorException = class extends Error {
        constructor(message, code, data) {
          super(message);
          this.message = message;
          this.code = code;
          this.data = data;
        }
      };
      getPlatformId = (win) => {
        var _a, _b;
        if (win === null || win === void 0 ? void 0 : win.androidBridge) {
          return "android";
        } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
          return "ios";
        } else {
          return "web";
        }
      };
      createCapacitor = (win) => {
        const capCustomPlatform = win.CapacitorCustomPlatform || null;
        const cap = win.Capacitor || {};
        const Plugins = cap.Plugins = cap.Plugins || {};
        const getPlatform = () => {
          return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
        };
        const isNativePlatform = () => getPlatform() !== "web";
        const isPluginAvailable = (pluginName) => {
          const plugin = registeredPlugins.get(pluginName);
          if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
            return true;
          }
          if (getPluginHeader(pluginName)) {
            return true;
          }
          return false;
        };
        const getPluginHeader = (pluginName) => {
          var _a;
          return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
        };
        const handleError = (err) => win.console.error(err);
        const registeredPlugins = /* @__PURE__ */ new Map();
        const registerPlugin2 = (pluginName, jsImplementations = {}) => {
          const registeredPlugin = registeredPlugins.get(pluginName);
          if (registeredPlugin) {
            console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
            return registeredPlugin.proxy;
          }
          const platform = getPlatform();
          const pluginHeader = getPluginHeader(pluginName);
          let jsImplementation;
          const loadPluginImplementation = async () => {
            if (!jsImplementation && platform in jsImplementations) {
              jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
            } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
              jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
            }
            return jsImplementation;
          };
          const createPluginMethod = (impl, prop) => {
            var _a, _b;
            if (pluginHeader) {
              const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
              if (methodHeader) {
                if (methodHeader.rtype === "promise") {
                  return (options) => cap.nativePromise(pluginName, prop.toString(), options);
                } else {
                  return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
                }
              } else if (impl) {
                return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
              }
            } else if (impl) {
              return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
            } else {
              throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
            }
          };
          const createPluginMethodWrapper = (prop) => {
            let remove;
            const wrapper = (...args) => {
              const p = loadPluginImplementation().then((impl) => {
                const fn = createPluginMethod(impl, prop);
                if (fn) {
                  const p2 = fn(...args);
                  remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                  return p2;
                } else {
                  throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
                }
              });
              if (prop === "addListener") {
                p.remove = async () => remove();
              }
              return p;
            };
            wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
            Object.defineProperty(wrapper, "name", {
              value: prop,
              writable: false,
              configurable: false
            });
            return wrapper;
          };
          const addListener = createPluginMethodWrapper("addListener");
          const removeListener = createPluginMethodWrapper("removeListener");
          const addListenerNative = (eventName, callback) => {
            const call = addListener({ eventName }, callback);
            const remove = async () => {
              const callbackId = await call;
              removeListener({
                eventName,
                callbackId
              }, callback);
            };
            const p = new Promise((resolve) => call.then(() => resolve({ remove })));
            p.remove = async () => {
              console.warn(`Using addListener() without 'await' is deprecated.`);
              await remove();
            };
            return p;
          };
          const proxy = new Proxy({}, {
            get(_, prop) {
              switch (prop) {
                // https://github.com/facebook/react/issues/20030
                case "$$typeof":
                  return void 0;
                case "toJSON":
                  return () => ({});
                case "addListener":
                  return pluginHeader ? addListenerNative : addListener;
                case "removeListener":
                  return removeListener;
                default:
                  return createPluginMethodWrapper(prop);
              }
            }
          });
          Plugins[pluginName] = proxy;
          registeredPlugins.set(pluginName, {
            name: pluginName,
            proxy,
            platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
          });
          return proxy;
        };
        if (!cap.convertFileSrc) {
          cap.convertFileSrc = (filePath) => filePath;
        }
        cap.getPlatform = getPlatform;
        cap.handleError = handleError;
        cap.isNativePlatform = isNativePlatform;
        cap.isPluginAvailable = isPluginAvailable;
        cap.registerPlugin = registerPlugin2;
        cap.Exception = CapacitorException;
        cap.DEBUG = !!cap.DEBUG;
        cap.isLoggingEnabled = !!cap.isLoggingEnabled;
        return cap;
      };
      initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
      Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
      registerPlugin = Capacitor.registerPlugin;
      WebPlugin = class {
        constructor() {
          this.listeners = {};
          this.retainedEventArguments = {};
          this.windowListeners = {};
        }
        addListener(eventName, listenerFunc) {
          let firstListener = false;
          const listeners = this.listeners[eventName];
          if (!listeners) {
            this.listeners[eventName] = [];
            firstListener = true;
          }
          this.listeners[eventName].push(listenerFunc);
          const windowListener = this.windowListeners[eventName];
          if (windowListener && !windowListener.registered) {
            this.addWindowListener(windowListener);
          }
          if (firstListener) {
            this.sendRetainedArgumentsForEvent(eventName);
          }
          const remove = async () => this.removeListener(eventName, listenerFunc);
          const p = Promise.resolve({ remove });
          return p;
        }
        async removeAllListeners() {
          this.listeners = {};
          for (const listener in this.windowListeners) {
            this.removeWindowListener(this.windowListeners[listener]);
          }
          this.windowListeners = {};
        }
        notifyListeners(eventName, data, retainUntilConsumed) {
          const listeners = this.listeners[eventName];
          if (!listeners) {
            if (retainUntilConsumed) {
              let args = this.retainedEventArguments[eventName];
              if (!args) {
                args = [];
              }
              args.push(data);
              this.retainedEventArguments[eventName] = args;
            }
            return;
          }
          listeners.forEach((listener) => listener(data));
        }
        hasListeners(eventName) {
          var _a;
          return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
        }
        registerWindowListener(windowEventName, pluginEventName) {
          this.windowListeners[pluginEventName] = {
            registered: false,
            windowEventName,
            pluginEventName,
            handler: (event) => {
              this.notifyListeners(pluginEventName, event);
            }
          };
        }
        unimplemented(msg = "not implemented") {
          return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
        }
        unavailable(msg = "not available") {
          return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
        }
        async removeListener(eventName, listenerFunc) {
          const listeners = this.listeners[eventName];
          if (!listeners) {
            return;
          }
          const index = listeners.indexOf(listenerFunc);
          this.listeners[eventName].splice(index, 1);
          if (!this.listeners[eventName].length) {
            this.removeWindowListener(this.windowListeners[eventName]);
          }
        }
        addWindowListener(handle) {
          window.addEventListener(handle.windowEventName, handle.handler);
          handle.registered = true;
        }
        removeWindowListener(handle) {
          if (!handle) {
            return;
          }
          window.removeEventListener(handle.windowEventName, handle.handler);
          handle.registered = false;
        }
        sendRetainedArgumentsForEvent(eventName) {
          const args = this.retainedEventArguments[eventName];
          if (!args) {
            return;
          }
          delete this.retainedEventArguments[eventName];
          args.forEach((arg) => {
            this.notifyListeners(eventName, arg);
          });
        }
      };
      encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
      decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
      CapacitorCookiesPluginWeb = class extends WebPlugin {
        async getCookies() {
          const cookies = document.cookie;
          const cookieMap = {};
          cookies.split(";").forEach((cookie) => {
            if (cookie.length <= 0)
              return;
            let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
            key = decode(key).trim();
            value = decode(value).trim();
            cookieMap[key] = value;
          });
          return cookieMap;
        }
        async setCookie(options) {
          try {
            const encodedKey = encode(options.key);
            const encodedValue = encode(options.value);
            const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
            const path = (options.path || "/").replace("path=", "");
            const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
            document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async deleteCookie(options) {
          try {
            document.cookie = `${options.key}=; Max-Age=0`;
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async clearCookies() {
          try {
            const cookies = document.cookie.split(";") || [];
            for (const cookie of cookies) {
              document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
            }
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async clearAllCookies() {
          try {
            await this.clearCookies();
          } catch (error) {
            return Promise.reject(error);
          }
        }
      };
      CapacitorCookies = registerPlugin("CapacitorCookies", {
        web: () => new CapacitorCookiesPluginWeb()
      });
      readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result;
          resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
      });
      normalizeHttpHeaders = (headers = {}) => {
        const originalKeys = Object.keys(headers);
        const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
        const normalized = loweredKeys.reduce((acc, key, index) => {
          acc[key] = headers[originalKeys[index]];
          return acc;
        }, {});
        return normalized;
      };
      buildUrlParams = (params, shouldEncode = true) => {
        if (!params)
          return null;
        const output = Object.entries(params).reduce((accumulator, entry) => {
          const [key, value] = entry;
          let encodedValue;
          let item;
          if (Array.isArray(value)) {
            item = "";
            value.forEach((str) => {
              encodedValue = shouldEncode ? encodeURIComponent(str) : str;
              item += `${key}=${encodedValue}&`;
            });
            item.slice(0, -1);
          } else {
            encodedValue = shouldEncode ? encodeURIComponent(value) : value;
            item = `${key}=${encodedValue}`;
          }
          return `${accumulator}&${item}`;
        }, "");
        return output.substr(1);
      };
      buildRequestInit = (options, extra = {}) => {
        const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
        const headers = normalizeHttpHeaders(options.headers);
        const type = headers["content-type"] || "";
        if (typeof options.data === "string") {
          output.body = options.data;
        } else if (type.includes("application/x-www-form-urlencoded")) {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(options.data || {})) {
            params.set(key, value);
          }
          output.body = params.toString();
        } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
          const form = new FormData();
          if (options.data instanceof FormData) {
            options.data.forEach((value, key) => {
              form.append(key, value);
            });
          } else {
            for (const key of Object.keys(options.data)) {
              form.append(key, options.data[key]);
            }
          }
          output.body = form;
          const headers2 = new Headers(output.headers);
          headers2.delete("content-type");
          output.headers = headers2;
        } else if (type.includes("application/json") || typeof options.data === "object") {
          output.body = JSON.stringify(options.data);
        }
        return output;
      };
      CapacitorHttpPluginWeb = class extends WebPlugin {
        /**
         * Perform an Http request given a set of options
         * @param options Options to build the HTTP request
         */
        async request(options) {
          const requestInit = buildRequestInit(options, options.webFetchExtra);
          const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
          const url = urlParams ? `${options.url}?${urlParams}` : options.url;
          const response = await fetch(url, requestInit);
          const contentType = response.headers.get("content-type") || "";
          let { responseType = "text" } = response.ok ? options : {};
          if (contentType.includes("application/json")) {
            responseType = "json";
          }
          let data;
          let blob;
          switch (responseType) {
            case "arraybuffer":
            case "blob":
              blob = await response.blob();
              data = await readBlobAsBase64(blob);
              break;
            case "json":
              data = await response.json();
              break;
            case "document":
            case "text":
            default:
              data = await response.text();
          }
          const headers = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });
          return {
            data,
            headers,
            status: response.status,
            url: response.url
          };
        }
        /**
         * Perform an Http GET request given a set of options
         * @param options Options to build the HTTP request
         */
        async get(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
        }
        /**
         * Perform an Http POST request given a set of options
         * @param options Options to build the HTTP request
         */
        async post(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
        }
        /**
         * Perform an Http PUT request given a set of options
         * @param options Options to build the HTTP request
         */
        async put(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
        }
        /**
         * Perform an Http PATCH request given a set of options
         * @param options Options to build the HTTP request
         */
        async patch(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
        }
        /**
         * Perform an Http DELETE request given a set of options
         * @param options Options to build the HTTP request
         */
        async delete(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
        }
      };
      CapacitorHttp = registerPlugin("CapacitorHttp", {
        web: () => new CapacitorHttpPluginWeb()
      });
      (function(SystemBarsStyle2) {
        SystemBarsStyle2["Dark"] = "DARK";
        SystemBarsStyle2["Light"] = "LIGHT";
        SystemBarsStyle2["Default"] = "DEFAULT";
      })(SystemBarsStyle || (SystemBarsStyle = {}));
      (function(SystemBarType2) {
        SystemBarType2["StatusBar"] = "StatusBar";
        SystemBarType2["NavigationBar"] = "NavigationBar";
      })(SystemBarType || (SystemBarType = {}));
      SystemBarsPluginWeb = class extends WebPlugin {
        async setStyle() {
          this.unavailable("not available for web");
        }
        async setAnimation() {
          this.unavailable("not available for web");
        }
        async show() {
          this.unavailable("not available for web");
        }
        async hide() {
          this.unavailable("not available for web");
        }
      };
      SystemBars = registerPlugin("SystemBars", {
        web: () => new SystemBarsPluginWeb()
      });
    }
  });

  // ../node_modules/@capacitor/haptics/dist/esm/definitions.js
  var ImpactStyle, NotificationType;
  var init_definitions = __esm({
    "../node_modules/@capacitor/haptics/dist/esm/definitions.js"() {
      "use strict";
      (function(ImpactStyle2) {
        ImpactStyle2["Heavy"] = "HEAVY";
        ImpactStyle2["Medium"] = "MEDIUM";
        ImpactStyle2["Light"] = "LIGHT";
      })(ImpactStyle || (ImpactStyle = {}));
      (function(NotificationType2) {
        NotificationType2["Success"] = "SUCCESS";
        NotificationType2["Warning"] = "WARNING";
        NotificationType2["Error"] = "ERROR";
      })(NotificationType || (NotificationType = {}));
    }
  });

  // ../node_modules/@capacitor/haptics/dist/esm/web.js
  var web_exports = {};
  __export(web_exports, {
    HapticsWeb: () => HapticsWeb
  });
  var HapticsWeb;
  var init_web = __esm({
    "../node_modules/@capacitor/haptics/dist/esm/web.js"() {
      "use strict";
      init_dist();
      init_definitions();
      HapticsWeb = class extends WebPlugin {
        constructor() {
          super(...arguments);
          this.selectionStarted = false;
        }
        async impact(options) {
          const pattern = this.patternForImpact(options === null || options === void 0 ? void 0 : options.style);
          this.vibrateWithPattern(pattern);
        }
        async notification(options) {
          const pattern = this.patternForNotification(options === null || options === void 0 ? void 0 : options.type);
          this.vibrateWithPattern(pattern);
        }
        async vibrate(options) {
          const duration = (options === null || options === void 0 ? void 0 : options.duration) || 300;
          this.vibrateWithPattern([duration]);
        }
        async selectionStart() {
          this.selectionStarted = true;
        }
        async selectionChanged() {
          if (this.selectionStarted) {
            this.vibrateWithPattern([70]);
          }
        }
        async selectionEnd() {
          this.selectionStarted = false;
        }
        patternForImpact(style = ImpactStyle.Heavy) {
          if (style === ImpactStyle.Medium) {
            return [43];
          } else if (style === ImpactStyle.Light) {
            return [20];
          }
          return [61];
        }
        patternForNotification(type = NotificationType.Success) {
          if (type === NotificationType.Warning) {
            return [30, 40, 30, 50, 60];
          } else if (type === NotificationType.Error) {
            return [27, 45, 50];
          }
          return [35, 65, 21];
        }
        vibrateWithPattern(pattern) {
          if (navigator.vibrate) {
            navigator.vibrate(pattern);
          } else {
            throw this.unavailable("Browser does not support the vibrate API");
          }
        }
      };
    }
  });

  // ../src/game/ui/base.css
  var __el = document.createElement("style");
  __el.textContent = `html {
    overflow: hidden;
    position: fixed;
    width: 100%;
    height: 100%;
    touch-action: none;
}
canvas {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
}
body {
    background: #050505;
    color: #5f5;
    font-family: monospace;
    margin: 0;
    overflow: hidden;
    position: fixed;
    width: 100%;
    height: 100%;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
}
#gameCanvas {
    background: #050505;
    display: block;
}
#flash-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #fff;
    opacity: 0;
    pointer-events: none;
    z-index: 150;
    mix-blend-mode: overlay;
    transition: opacity 0.1s;
}
#rain-overlay {
    position: absolute;
    top: -50%;
    left: -25%;
    width: 150%;
    height: 200%;
    pointer-events: none;
    z-index: 99;
    display: none;
    transform: rotate(var(--rain-angle, -10deg));
}
#rain-overlay::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='150'><line x1='12' y1='5' x2='14' y2='18' stroke='%23a0d2ff' stroke-opacity='.35' stroke-width='1'/><line x1='48' y1='12' x2='50' y2='23' stroke='%23a0d2ff' stroke-opacity='.22' stroke-width='1'/><line x1='85' y1='3' x2='87' y2='17' stroke='%23a0d2ff' stroke-opacity='.30' stroke-width='1'/><line x1='122' y1='18' x2='124' y2='30' stroke='%23a0d2ff' stroke-opacity='.28' stroke-width='1'/><line x1='158' y1='6' x2='160' y2='21' stroke='%23a0d2ff' stroke-opacity='.33' stroke-width='1'/><line x1='195' y1='15' x2='197' y2='26' stroke='%23a0d2ff' stroke-opacity='.20' stroke-width='1'/><line x1='232' y1='8' x2='234' y2='21' stroke='%23a0d2ff' stroke-opacity='.30' stroke-width='1'/><line x1='268' y1='4' x2='270' y2='16' stroke='%23a0d2ff' stroke-opacity='.25' stroke-width='1'/><line x1='28' y1='50' x2='30' y2='62' stroke='%23a0d2ff' stroke-opacity='.28' stroke-width='1'/><line x1='68' y1='45' x2='70' y2='59' stroke='%23a0d2ff' stroke-opacity='.35' stroke-width='1'/><line x1='105' y1='58' x2='107' y2='69' stroke='%23a0d2ff' stroke-opacity='.22' stroke-width='1'/><line x1='142' y1='42' x2='144' y2='55' stroke='%23a0d2ff' stroke-opacity='.30' stroke-width='1'/><line x1='178' y1='55' x2='180' y2='70' stroke='%23a0d2ff' stroke-opacity='.25' stroke-width='1'/><line x1='215' y1='48' x2='217' y2='60' stroke='%23a0d2ff' stroke-opacity='.33' stroke-width='1'/><line x1='252' y1='62' x2='254' y2='73' stroke='%23a0d2ff' stroke-opacity='.20' stroke-width='1'/><line x1='18' y1='98' x2='20' y2='111' stroke='%23a0d2ff' stroke-opacity='.30' stroke-width='1'/><line x1='55' y1='105' x2='57' y2='117' stroke='%23a0d2ff' stroke-opacity='.22' stroke-width='1'/><line x1='92' y1='92' x2='94' y2='106' stroke='%23a0d2ff' stroke-opacity='.35' stroke-width='1'/><line x1='130' y1='110' x2='132' y2='121' stroke='%23a0d2ff' stroke-opacity='.25' stroke-width='1'/><line x1='168' y1='95' x2='170' y2='108' stroke='%23a0d2ff' stroke-opacity='.30' stroke-width='1'/><line x1='205' y1='108' x2='207' y2='120' stroke='%23a0d2ff' stroke-opacity='.22' stroke-width='1'/><line x1='242' y1='98' x2='244' y2='113' stroke='%23a0d2ff' stroke-opacity='.28' stroke-width='1'/><line x1='278' y1='112' x2='280' y2='123' stroke='%23a0d2ff' stroke-opacity='.20' stroke-width='1'/></svg>");
    background-size: 300px 150px;
    animation: rain-fall 0.7s linear infinite;
}
#rain-overlay::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='150'><line x1='30' y1='28' x2='32' y2='40' stroke='%23a0d2ff' stroke-opacity='.22' stroke-width='1'/><line x1='72' y1='35' x2='74' y2='49' stroke='%23a0d2ff' stroke-opacity='.30' stroke-width='1'/><line x1='115' y1='22' x2='117' y2='33' stroke='%23a0d2ff' stroke-opacity='.25' stroke-width='1'/><line x1='152' y1='38' x2='154' y2='51' stroke='%23a0d2ff' stroke-opacity='.33' stroke-width='1'/><line x1='188' y1='25' x2='190' y2='37' stroke='%23a0d2ff' stroke-opacity='.20' stroke-width='1'/><line x1='225' y1='32' x2='227' y2='46' stroke='%23a0d2ff' stroke-opacity='.28' stroke-width='1'/><line x1='262' y1='18' x2='264' y2='29' stroke='%23a0d2ff' stroke-opacity='.22' stroke-width='1'/><line x1='8' y1='72' x2='10' y2='85' stroke='%23a0d2ff' stroke-opacity='.28' stroke-width='1'/><line x1='45' y1='80' x2='47' y2='92' stroke='%23a0d2ff' stroke-opacity='.22' stroke-width='1'/><line x1='82' y1='68' x2='84' y2='82' stroke='%23a0d2ff' stroke-opacity='.35' stroke-width='1'/><line x1='118' y1='78' x2='120' y2='89' stroke='%23a0d2ff' stroke-opacity='.25' stroke-width='1'/><line x1='155' y1='65' x2='157' y2='80' stroke='%23a0d2ff' stroke-opacity='.30' stroke-width='1'/><line x1='192' y1='75' x2='194' y2='87' stroke='%23a0d2ff' stroke-opacity='.22' stroke-width='1'/><line x1='228' y1='82' x2='230' y2='95' stroke='%23a0d2ff' stroke-opacity='.28' stroke-width='1'/><line x1='265' y1='70' x2='267' y2='81' stroke='%23a0d2ff' stroke-opacity='.20' stroke-width='1'/><line x1='22' y1='120' x2='24' y2='134' stroke='%23a0d2ff' stroke-opacity='.30' stroke-width='1'/><line x1='60' y1='132' x2='62' y2='144' stroke='%23a0d2ff' stroke-opacity='.22' stroke-width='1'/><line x1='98' y1='118' x2='100' y2='131' stroke='%23a0d2ff' stroke-opacity='.28' stroke-width='1'/><line x1='135' y1='128' x2='137' y2='139' stroke='%23a0d2ff' stroke-opacity='.25' stroke-width='1'/><line x1='172' y1='115' x2='174' y2='129' stroke='%23a0d2ff' stroke-opacity='.33' stroke-width='1'/><line x1='210' y1='125' x2='212' y2='137' stroke='%23a0d2ff' stroke-opacity='.20' stroke-width='1'/><line x1='248' y1='120' x2='250' y2='133' stroke='%23a0d2ff' stroke-opacity='.28' stroke-width='1'/><line x1='282' y1='135' x2='284' y2='146' stroke='%23a0d2ff' stroke-opacity='.22' stroke-width='1'/></svg>");
    background-size: 300px 150px;
    background-position: 150px 75px;
    animation: rain-fall 0.7s linear infinite 0.35s;
}
@keyframes rain-fall {
    from { transform: translateY(0); }
    to   { transform: translateY(150px); }
}
#audio-mute {
    position: absolute;
    top: 0;
    left: 0;
    font-size: 16px;
    display: block;
    border: none;
    background-color: none;
    padding: 2px;
    margin: 5px;
    margin-top: max(5px, env(safe-area-inset-top));
    margin-left: max(5px, env(safe-area-inset-left));
    z-index: 1000;
}
#audio-mute-inactive {
    display: none;
}
#audio-mute-active {
    display: none;
}
#easter-egg {
    position: absolute;
    top: max(7px, calc(env(safe-area-inset-top) + 7px));
    left: max(46px, calc(env(safe-area-inset-left) + 46px));
    width: 18px;
    height: 18px;
    background: #000;
    border: 1px solid #222;
    opacity: 0.18;
    cursor: default;
    z-index: 1000;
    transition: opacity 0.4s;
}
#easter-egg:hover {
    opacity: 0.75;
    cursor: pointer;
}
.title {
    font-size: 64px;
    color: #ff6600;
    text-shadow: 0 0 20px #ff6600;
    margin-bottom: 5px;
    font-weight: bold;
}
.subtitle {
    font-size: 20px;
    color: #5f5;
    margin-bottom: 30px;
    letter-spacing: 4px;
}
.start-hint {
    font-size: 22px;
    animation: blink 1s infinite;
    color: #fff;
    margin-top: 30px;
    cursor: pointer;
}
@keyframes blink {
    50% {
        opacity: 0;
    }
}
#msg {
    position: absolute;
    top: 20%;
    width: 100%;
    text-align: center;
    font-size: 24px;
    color: #fff;
    text-shadow: 0 0 5px #000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.5s;
    z-index: 300;
}
#menu-heli-big {
    width: 800px;
    height: 300px;
    margin-bottom: 20px;
    filter: drop-shadow(0 0 15px rgba(255, 102, 0, 0.3));
}
@media (max-height: 520px) {
    .title {
        font-size: clamp(26px, 7vh, 64px);
        text-shadow: 0 0 10px #ff6600;
        margin-bottom: 2px;
    }
    .subtitle {
        font-size: 14px;
        margin-bottom: 12px;
    }
    .start-hint {
        font-size: 16px;
        margin-top: 14px;
    }
    #menu-heli-big {
        transform: scale(0.45);
        transform-origin: center top;
        margin-bottom: -120px;
    }
}
`;
  document.head.appendChild(__el);

  // ../src/game/ui/screens.css
  var __el2 = document.createElement("style");
  __el2.textContent = "/* \u2500\u2500\u2500 shared full-screen overlay base \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.screen-body {\n    width: 100%;\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n}\n.ui-screen {\n    overflow-x: hidden;\n    overflow-y: auto;\n    -webkit-overflow-scrolling: touch;\n    box-sizing: border-box;\n    padding: clamp(14px, 3vh, 28px) 0;\n    padding-top: max(clamp(14px, 3vh, 28px), env(safe-area-inset-top));\n    padding-bottom: max(clamp(14px, 3vh, 28px), env(safe-area-inset-bottom));\n    touch-action: pan-y manipulation;\n}\n@media (max-height: 600px) {\n    .ui-screen { justify-content: flex-start; }\n}\n\n/* \u2500\u2500\u2500 campaign-complete \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#campaign-complete-screen {\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    background: rgb(0, 30, 60);\n    display: none;\n    flex-direction: column;\n    justify-content: safe center;\n    align-items: center;\n    z-index: 200;\n    cursor: pointer;\n}\n#campaign-failed-screen {\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    background: rgb(60, 0, 0);\n    display: none;\n    flex-direction: column;\n    justify-content: safe center;\n    align-items: center;\n    z-index: 210;\n    cursor: pointer;\n}\n#splash,\n#campaign-select,\n#mission-select,\n#heli-select,\n#crash-screen,\n#mission-success-screen,\n#win-screen {\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    background: rgb(5, 5, 5);\n    display: flex;\n    flex-direction: column;\n    justify-content: safe center;\n    align-items: center;\n    z-index: 200;\n    cursor: default;\n}\n#crash-screen {\n    background: rgb(60, 0, 0);\n    display: none;\n}\n#mission-success-screen,\n#win-screen {\n    background: rgb(0, 60, 30);\n    display: none;\n}\n#splash,\n#campaign-select,\n#mission-select,\n#heli-select {\n    display: none;\n}\n\n#campaign-switch-warning {\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    background: rgba(0, 0, 0, 0.88);\n    display: none;\n    flex-direction: column;\n    justify-content: center;\n    align-items: center;\n    z-index: 300;\n}\n.grid-container,\n.campaign-grid {\n    display: grid;\n    grid-template-columns: 1fr 1fr 1fr;\n    gap: 20px;\n    width: 1100px;\n    height: 350px;\n}\n.grid-box {\n    background: rgba(0, 40, 15, 0.4);\n    border: 1px solid #3a3;\n    color: #585;\n    display: flex;\n    flex-direction: column;\n    justify-content: center;\n    align-items: center;\n    text-align: center;\n    font-size: 16px;\n    transition: 0.2s;\n    border-radius: 4px;\n    cursor: pointer;\n    padding: 10px;\n}\n.grid-box:hover {\n    background: rgba(0, 60, 30, 0.9);\n    border-color: #5f5;\n    color: #fff;\n    box-shadow: 0 0 30px #ff6600;\n    transform: scale(1.02);\n    z-index: 10;\n}\n.box-label {\n    font-weight: bold;\n    font-size: 18px;\n    margin-top: 10px;\n    text-transform: uppercase;\n}\n.box-sub {\n    font-size: 13px;\n    margin-top: 5px;\n    opacity: 0.8;\n}\n.mini-canvas {\n    width: 100%;\n    height: 120px;\n    margin-bottom: 5px;\n    pointer-events: none;\n}\n.grid-box.locked {\n    opacity: 0.2;\n    cursor: not-allowed;\n    pointer-events: none;\n    filter: grayscale(1);\n    border-color: #1a1a1a;\n}\n@media (max-width: 1100px) {\n    .grid-container,\n    .campaign-grid {\n        width: min(1100px, 92vw);\n    }\n}\n@media (max-height: 520px) {\n    .grid-container,\n    .campaign-grid {\n        height: auto;\n        gap: 10px;\n    }\n    .grid-box {\n        font-size: 13px;\n    }\n    .grid-box canvas {\n        transform: scale(0.5);\n        transform-origin: center top;\n        margin-bottom: -80px;\n    }\n    .box-label {\n        font-size: 13px;\n        margin-top: 4px;\n    }\n    .box-sub {\n        font-size: 11px;\n    }\n}\n";
  document.head.appendChild(__el2);

  // ../src/game/storage-stub.ts
  var storageGet = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  var storageSet = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (_) {
    }
  };
  var storageRemove = (key) => {
    try {
      localStorage.removeItem(key);
    } catch (_) {
    }
  };

  // ../src/game/session.ts
  var STORAGE_KEY = "zeewolf_session";
  var _IS_APP = false;
  var CONSENT_TTL_MS = 14 * 24 * 60 * 60 * 1e3;
  var RANKS = [
    { name: "Leutnant", pips: "\u2605", minMissions: 0 },
    { name: "Oberleutnant", pips: "\u2605  \u2605", minMissions: 10 },
    { name: "Hauptmann", pips: "\u2605 \u2605 \u2605", minMissions: 30 },
    { name: "Major", pips: "\u25C6", minMissions: 60 }
  ];
  var _default = () => ({
    cookieConsent: null,
    consentTimestamp: null,
    consentVersion: "",
    playerName: "",
    activeCampaignIndex: 0,
    highestUnlockedCampaignIndex: 0,
    campaignProgress: {},
    rankOverride: 0,
    allUnlocked: false,
    lastSeenVersion: ""
  });
  var loadSession = () => {
    try {
      const raw = storageGet(STORAGE_KEY);
      if (!raw) return _default();
      return { ..._default(), ...JSON.parse(raw) };
    } catch {
      return _default();
    }
  };
  var saveSession = (s) => {
    if (_IS_APP) {
      try {
        storageSet(STORAGE_KEY, JSON.stringify(s));
      } catch {
      }
      return;
    }
    if (!s.cookieConsent) return;
    try {
      storageSet(STORAGE_KEY, JSON.stringify(s));
    } catch {
    }
  };
  var getMissionsDone = (s) => Object.values(s.campaignProgress).reduce(
    (sum, cp) => sum + cp.missions.filter((m) => m.completed).length,
    0
  );
  var getCampaignsDone = (s) => Object.values(s.campaignProgress).filter((cp) => cp.completed).length;
  var getRank = (s, nonTutorialMissions) => {
    const missions = nonTutorialMissions ?? getMissionsDone(s);
    let derivedIdx = 0;
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (missions >= RANKS[i].minMissions) {
        derivedIdx = i;
        break;
      }
    }
    return RANKS[Math.max(derivedIdx, s.rankOverride ?? 0)];
  };
  var isCampaignUnlocked = (s, campaigns, index) => {
    const type = campaigns[index]?.type;
    if (!type) return false;
    if (s.allUnlocked) return true;
    if (type === "tutorial") return true;
    if (index <= (s.highestUnlockedCampaignIndex ?? 0)) return true;
    const tutorialIndex = campaigns.findIndex((c) => c.type === "tutorial");
    const tutorialDone = tutorialIndex === -1 || !!s.campaignProgress[String(tutorialIndex)]?.completed;
    if (!tutorialDone) return false;
    if (type === "free-flight") return true;
    const regular = campaigns.map((c, i) => ({ type: c.type, i })).filter((c) => (!_IS_APP ? c.type !== "multiplayer" : true) && c.type !== "tutorial" && c.type !== "free-flight");
    const pos = regular.findIndex((c) => c.i === index);
    if (pos <= 0) return true;
    const prev = regular[pos - 1];
    return !!s.campaignProgress[String(prev.i)]?.completed;
  };
  var isMissionUnlocked = (s, campaignKey, missionIndex, campaignType) => {
    if (s.allUnlocked || campaignType === "free-flight") return true;
    if (missionIndex === 0) return true;
    return !!s.campaignProgress[campaignKey]?.missions[missionIndex - 1]?.completed;
  };
  var B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  var _checksumBits = (bits) => {
    let acc = 0;
    for (let i = 0; i < 37; i++) {
      if (bits[i]) acc ^= 1 << i % 8;
    }
    return acc & 255;
  };
  var encodeSession = (s, nonTutorialMissions) => {
    const rankIdx = RANKS.indexOf(getRank(s, nonTutorialMissions));
    const highest = Math.min(s.highestUnlockedCampaignIndex ?? 0, 7);
    const active = Math.min(s.activeCampaignIndex, 7);
    const activeCp = s.campaignProgress[String(s.activeCampaignIndex)];
    const nextMission = Math.min(activeCp ? activeCp.missions.filter((m) => m.completed).length : 0, 15);
    const callsign = (s.playerName || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
    const bits = [];
    const push = (val, n) => {
      for (let i = n - 1; i >= 0; i--) bits.push(val >> i & 1);
    };
    push(rankIdx, 2);
    push(highest, 3);
    push(active, 3);
    push(nextMission, 4);
    for (let i = 0; i < 5; i++) {
      push(i < callsign.length ? callsign.charCodeAt(i) - 65 : 26, 5);
    }
    push(_checksumBits(bits), 8);
    let code = "";
    for (let i = 0; i < 9; i++) {
      const val = bits.slice(i * 5, i * 5 + 5).reduce((a, b) => a << 1 | b, 0);
      code += B32[val];
    }
    return code.slice(0, 5) + "-" + code.slice(5);
  };
  var decodeSession = (input) => {
    const clean = input.toUpperCase().replace(/[^A-Z234567]/g, "");
    if (clean.length !== 9) return null;
    const bits = [];
    for (const ch of clean) {
      const v = B32.indexOf(ch);
      if (v < 0) return null;
      for (let i = 4; i >= 0; i--) bits.push(v >> i & 1);
    }
    const read = (start, n) => bits.slice(start, start + n).reduce((a, b) => a << 1 | b, 0);
    if (read(37, 8) !== _checksumBits(bits)) return null;
    const rankIdx = Math.min(read(0, 2), RANKS.length - 1);
    const highestUnlockedCampaignIndex = read(2, 3);
    const activeCampaignIndex = read(5, 3);
    const nextMission = read(8, 4);
    let playerName = "";
    for (let i = 0; i < 5; i++) {
      const v = read(12 + i * 5, 5);
      if (v === 26) break;
      if (v < 26) playerName += String.fromCharCode(65 + v);
    }
    const campaignProgress = {};
    if (nextMission > 0) {
      campaignProgress[String(activeCampaignIndex)] = {
        completed: false,
        missions: Array.from({ length: nextMission }, () => ({ completed: true, bestTimeMs: null }))
      };
    }
    return {
      playerName,
      activeCampaignIndex,
      highestUnlockedCampaignIndex,
      rankOverride: rankIdx,
      campaignProgress
    };
  };

  // ../src/game/ui/main-menu/main-menu.css
  var __el3 = document.createElement("style");
  __el3.textContent = "/* \u2500\u2500\u2500 splash \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#splash {\n    cursor: pointer;\n    transform-origin: center center;\n}\n\n@keyframes crtCollapse {\n    0%   { transform: scaleY(1)     scaleX(1);    filter: brightness(1); }\n    50%  { transform: scaleY(0.012) scaleX(1);    filter: brightness(4); }\n    72%  { transform: scaleY(0.012) scaleX(0.35); filter: brightness(2.5); }\n    88%  { transform: scaleY(0.012) scaleX(0.04); filter: brightness(5); }\n    100% { transform: scaleY(0.012) scaleX(0);    filter: brightness(0); }\n}\n#splash.crt-collapse {\n    animation: crtCollapse 380ms cubic-bezier(0.4, 0, 1, 1) forwards;\n    pointer-events: none;\n}\n\n@keyframes splashFlicker {\n    0%   { color: inherit; text-shadow: none; }\n    12%  { color: #fff; text-shadow: 0 0 24px #fff, 0 0 70px rgba(255,255,255,0.6); }\n    28%  { color: inherit; text-shadow: none; }\n    50%  { color: #ddd; text-shadow: 0 0 16px #fff; }\n    62%  { color: inherit; text-shadow: none; }\n    80%  { color: #fff; text-shadow: 0 0 28px #fff, 0 0 80px rgba(255,255,255,0.5); }\n    100% { color: #fff; text-shadow: 0 0 22px #fff, 0 0 60px rgba(255,255,255,0.4); }\n}\n#splash.splash-clicked .title,\n#splash.splash-clicked .subtitle,\n#splash.splash-clicked .start-hint {\n    animation: splashFlicker 320ms ease-in forwards;\n}\n\n/* \u2500\u2500\u2500 i.thie softworks interstitial \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#ithie-splash {\n    position: fixed;\n    inset: 0;\n    background: transparent;\n    display: none;\n    align-items: center;\n    justify-content: center;\n    z-index: 9999;\n    opacity: 0;\n}\n.ithie-text {\n    font-size: 19px;\n    color: #5f5;\n    letter-spacing: 3px;\n    font-weight: bold;\n}\n.ithie-cursor {\n    color: #5f5;\n    font-size: 19px;\n    font-weight: bold;\n    margin-left: 2px;\n    animation: cursorBlink 650ms step-end infinite;\n}\n@keyframes cursorBlink {\n    0%, 100% { opacity: 1; }\n    50%       { opacity: 0; }\n}\n\n/* \u2500\u2500\u2500 logo interstitial \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#logo-splash {\n    position: fixed;\n    inset: 0;\n    background: transparent;\n    display: none;\n    align-items: center;\n    justify-content: center;\n    z-index: 9998;\n}\n.logo-splash-text {\n    font: italic 22px monospace;\n    letter-spacing: 2px;\n    color: #888;\n    text-align: center;\n    padding: 0 32px;\n}\n#logo-splash.crt-entering {\n    animation: crtExpand 380ms cubic-bezier(0, 0, 0.6, 1) forwards;\n}\n#logo-splash.crt-leaving {\n    animation: crtCollapse 380ms cubic-bezier(0.4, 0, 1, 1) forwards;\n    pointer-events: none;\n}\n\n/* \u2500\u2500\u2500 main menu \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#main-menu .subtitle {\n    margin-bottom: 44px;\n}\n#main-menu {\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    background: rgba(5, 5, 5, 0.88);\n    display: none;\n    flex-direction: column;\n    justify-content: center;\n    align-items: center;\n    z-index: 200;\n    cursor: default;\n}\n#main-menu-bg-canvas {\n    position: absolute;\n    top: 58%;\n    left: 50%;\n    width: 900px;\n    height: 500px;\n    transform: translate(-50%, -50%);\n    opacity: 0.12;\n    pointer-events: none;\n    filter: drop-shadow(0 0 30px rgba(255, 102, 0, 0.15));\n}\n.menu-nav {\n    display: flex;\n    flex-direction: column;\n    align-items: stretch;\n    gap: 10px;\n    position: relative;\n    z-index: 1;\n    margin-top: 16px;\n}\n.menu-item {\n    font-size: 24px;\n    font-weight: bold;\n    letter-spacing: 8px;\n    color: #4a8a4a;\n    cursor: pointer;\n    padding: 14px 52px;\n    border: 1px solid #2a5a2a;\n    text-align: center;\n    transition: all 0.25s ease;\n    position: relative;\n    overflow: hidden;\n}\n.menu-item::before {\n    content: '';\n    position: absolute;\n    left: -100%;\n    top: 0;\n    width: 100%;\n    height: 100%;\n    background: linear-gradient(90deg, transparent, rgba(255, 102, 0, 0.07), transparent);\n    transition: left 0.45s ease;\n}\n.menu-item:hover::before {\n    left: 100%;\n}\n.menu-item:hover {\n    color: #fff;\n    border-color: #ff6600;\n    text-shadow:\n        0 0 12px #ff6600,\n        0 0 30px rgba(255, 102, 0, 0.3);\n    box-shadow:\n        0 0 28px rgba(255, 102, 0, 0.2),\n        inset 0 0 28px rgba(255, 102, 0, 0.04);\n    transform: scaleX(1.03) translateY(-1px);\n}\n.menu-legal-link {\n    font-size: 10px;\n    letter-spacing: 3px;\n    color: #666;\n    cursor: pointer;\n    transition: color 0.2s;\n    position: absolute;\n    bottom: max(16px, env(safe-area-inset-bottom));\n    left: 0;\n    right: 0;\n    text-align: center;\n    z-index: 1;\n}\n.menu-legal-link:hover {\n    color: #999;\n}\n\n@media (max-height: 520px) {\n    .menu-item {\n        font-size: 18px;\n        padding: 9px 28px;\n        letter-spacing: 5px;\n    }\n    .menu-nav {\n        margin-top: 8px;\n        gap: 7px;\n    }\n    .menu-legal-link {\n        bottom: max(8px, env(safe-area-inset-bottom));\n    }\n}\n";
  document.head.appendChild(__el3);

  // ../src/game/i18n.ts
  var LANG_PREF_KEY = "zeewolf_lang";
  var _DATENSCHUTZ_DE = [
    "SAR: Callsign WOLF speichert folgende Daten lokal auf deinem Ger\xE4t:",
    "\u25B8 Rufzeichen  \u25B8 Dienstgrad  \u25B8 Kampagnenfortschritt  \u25B8 Spracheinstellung",
    "Die Daten werden ausschlie\xDFlich zur Spielfunktion genutzt und nicht an Dritte weitergegeben. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.",
    "Gespeicherte Daten k\xF6nnen jederzeit \xFCber Hauptmen\xFC \u2192 Einstellungen \u2192 Spielstand l\xF6schen gel\xF6scht werden.",
    "Die Steuerungseinstellung wird ebenfalls lokal gespeichert (rein technische Ger\xE4teeinstellung, kein Personenbezug).",
    "Kontakt f\xFCr Datenschutzanfragen: yarrick@web.de"
  ];
  var _DATENSCHUTZ_EN = [
    "SAR: Callsign WOLF stores the following data locally on your device:",
    "\u25B8 Callsign  \u25B8 Rank  \u25B8 Campaign progress  \u25B8 Language setting",
    "Data is used exclusively for game functionality and is not shared with third parties. Legal basis: Art. 6 para. 1 lit. b GDPR.",
    "Stored data can be deleted at any time via Main Menu \u2192 Settings \u2192 Delete Save.",
    "The control setting is also stored locally (purely technical device setting, no personal data).",
    "Privacy contact: yarrick@web.de"
  ];
  var _IS_APP2 = false;
  var _detectLang = () => {
    try {
      const stored = storageGet(LANG_PREF_KEY);
      if (stored === "de" || stored === "en") return stored;
      return navigator.language?.toLowerCase().startsWith("de") ? "de" : "en";
    } catch {
      return "de";
    }
  };
  var _DE = {
    DONE: "abgeschlossen",
    OUT_OF_FUEL: "KEIN TREIBSTOFF!",
    MAX_ALTITUDE: "MAX. H\xD6HE",
    CARGO_SECURED: "FRACHT GESICHERT!",
    PATIENT_SECURED: "PATIENT GESICHERT!",
    DELIVERED: "ABGELIEFERT!",
    ONBOARD: (n, max) => `AN BORD [${n}/${max}]`,
    CABIN_FULL: "KABINE VOLL!",
    DROP_AT_PAD: "AM LANDEPLATZ ABLEGEN!",
    SECURED: (rescued, total) => `GESICHERT: ${rescued}/${total}`,
    SOARING: "HOCH HINAUS \u2013 \u2191\u2193 PITCH  \u2190\u2192 BANK",
    ...!_IS_APP2 ? { PARTY_ON: "\u{1F389} PARTY MODE \u{1F389}", UNLOCK_ALL: "\u{1F513} ALL CAMPAIGNS UNLOCKED" } : {},
    SPLASH_TITLE: "SAR: CALLSIGN WOLF",
    SPLASH_HINT: "KLICKEN ZUM STARTEN",
    MENU_TITLE: "SAR: CALLSIGN WOLF",
    MENU_SUBTITLE: "MAIN SYSTEM",
    MENU_START: "SPIEL STARTEN",
    ...!_IS_APP2 ? {
      MENU_MULTIPLAYER: "MULTIPLAYER",
      MP_SUBTITLE: "KOOP-EINSATZ",
      MP_CREATE: "SPIEL ERSTELLEN",
      MP_JOIN: "BEITRETEN",
      MP_GENERATING: "GENERIERE...",
      MP_WAIT_ANSWER: "WARTE AUF ANTWORT...",
      MP_WAIT_CONNECT: "WARTE AUF VERBINDUNG...",
      MP_CONNECTING: "VERBINDE...",
      MP_CONNECTED: "VERBUNDEN",
      MP_ERROR: "FEHLER \u2013 BITTE ERNEUT VERSUCHEN",
      MP_READY_PROMPT: "BEREIT ZUM EINSATZ?",
      MP_READY_BTN: "BEREIT",
      MP_WAIT_READY: "WARTE AUF MITSPIELER...",
      MP_COPY: "KOPIEREN",
      MP_CONNECT: "VERBINDEN",
      MP_GEN_ANSWER: "ANTWORT GENERIEREN",
      MP_STEP1_HOST: "Schritt 1: Diesen Code an deinen Mitspieler senden:",
      MP_STEP2_HOST: "Schritt 2: Antwort des Mitspielers einf\xFCgen:",
      MP_STEP1_GUEST: "Code des Gastgebers einf\xFCgen:",
      MP_STEP2_GUEST: "Diesen Code an den Gastgeber senden:",
      MP_PASTE_HINT: "Code hier einf\xFCgen\u2026",
      CRASH_REMOTE_HELI: "KOLLISION MIT MITSPIELER"
    } : {},
    MENU_HELI: "HELIKOPTER",
    MENU_SETTINGS: "EINSTELLUNGEN",
    MENU_CREDITS: "CREDITS",
    NEXT: "Weiter",
    BACK: "\u25C0 ZUR\xDCCK",
    RETRY: "WIEDERHOLEN",
    RETURN_TO_BASE: "ZUR\xDCCK ZUR BASIS",
    CAMPAIGN_SELECT_TITLE: "KAMPAGNE W\xC4HLEN",
    CAMPAIGN_SELECT_SUB: "EINSATZGEBIET",
    CAMPAIGN_SELECT_MISSIONS: "Missionen",
    MISSION_SELECT_SUB: "EINS\xC4TZE",
    MISSION_LOCKED: "[ GESPERRT ]",
    BEST_TIME: (ms) => {
      const totalSec = ms / 1e3;
      const min = Math.floor(totalSec / 60);
      const sec = (totalSec % 60).toFixed(1);
      return `BESTZEIT: ${min}:${sec.padStart(4, "0")}`;
    },
    CAMPAIGN_SWITCH_WARNING: "Fortschritt wird zur\xFCckgesetzt.",
    CAMPAIGN_SWITCH_CONFIRM: "TROTZDEM WECHSELN",
    HELI_SELECT_TITLE: "HANGAR",
    HELI_SELECT_SUB: "LUFTFAHRZEUG W\xC4HLEN",
    HELI_SELECT_CONFIRM: "AUSW\xC4HLEN",
    HELI_LOCKED_FROM: (rank) => `ab ${rank}`,
    TERMINATED: "TERMINATED",
    MISSION_COMPLETE: "MISSION COMPLETE",
    OBJECTIVES_CLEARED: "ALL OBJECTIVES CLEARED",
    CAMPAIGN_COMPLETE: "CAMPAIGN COMPLETE",
    ALL_MISSIONS_CLEARED: "ALL MISSIONS CLEARED",
    CAMPAIGN_FAILED: "CAMPAIGN FAILED",
    MISSION_ABORTED: "MISSION ABORTED",
    CLICK_TO_DEPLOY: "KLICKEN ZUM EINSATZ",
    PILOT_ADDRESS: (rank, callsign) => `${rank} ${callsign || "WOLF"}`,
    BRIEFING_ADDRESS: (rank, callsign) => `Ihre Mission, ${rank} ${callsign || "WOLF"}`,
    SAVE_CODE_INVALID: "UNG\xDCLTIGER CODE",
    SAVE_CODE_LOADED: "SPIELSTAND GELADEN",
    NO_SAVE_STATE: "  |  KEIN SPEICHERSTAND",
    STATS: (c, m) => `KAMPAGNEN: ${c}  |  MISSIONEN: ${m}`,
    CAMPAIGN_LOCKED: "[ GESPERRT ]",
    DELETE_SESSION: "SPIELSTAND L\xD6SCHEN",
    DELETE_CONFIRM: "WIRKLICH L\xD6SCHEN?",
    SESSION_DELETED: "GEL\xD6SCHT \u2013 SEITE WIRD NEU GELADEN\u2026",
    DELIVER_MODE_ON: "ABSETZ-MODUS \u2014 [R] ABBRECHEN",
    DELIVER_MODE_OFF: "",
    DELIVERED_TO_ZONE: "PERSON ABGESETZT!",
    DELIVER_NO_ZONE: "KEINE ABSETZZONE HIER",
    CRASH_WATER: "WASSERAUFPRALL",
    CRASH_BAD_ZONE: "FALSCHES LANDEZIEL",
    CRASH_TOO_FAST: "ZU SCHNELL",
    CRASH_HARD_IMPACT: "HARTER AUFPRALL",
    CRASH_CARRIER_TOWER: "TR\xC4GERTURM-KOLLISION",
    CRASH_PARKED_HELI: "KOLLISION MIT ABGESTELLTEM HELI",
    CRASH_HANGAR: "HANGAR-KOLLISION",
    CRASH_TOWER: "TOWER-KOLLISION",
    CRASH_FUEL_TRUCK: "KOLLISION MIT TANKWAGEN",
    CRASH_LIGHTHOUSE: "LEUCHTTURM-KOLLISION",
    CRASH_BOAT: "KOLLISION MIT BOOT",
    CRASH_SUBMARINE: "KOLLISION MIT U-BOOT",
    CRASH_TREE: "BAUMKONTAKT",
    WHATS_NEW_HEADLINE: "NEUIGKEITEN",
    WHATS_NEW_VERSION: "v27.0.0",
    WHATS_NEW_TITLE: "Kampagne: Callsign Wolf",
    WHATS_NEW_HINT: "KLICKEN ZUM FORTFAHREN",
    WHATS_NEW_ITEMS: ["Jetzt als native iOS App spielbar", "\u{1F43A} Demo-Kampagne verf\xFCgbar: Callsign Wolf", "\u{1FAA6} R.I.P. _isMobile \u2014 du wirst nicht vermisst"],
    PILOT_HEADING: "PROFIL",
    PILOT_CALLSIGN: "RUFZEICHEN (MAX. 8 ZEICHEN, A\u2013Z)",
    PILOT_SAVECODE: "SAVE CODE",
    PILOT_IMPORT: "CODE IMPORTIEREN (\xDCBERSCHREIBT SPIELSTAND)",
    PILOT_IMPORTLOAD: "LADEN",
    CONTROLS_HEADING: "STEUERUNG",
    CONTROLS_SIMPLIFIED: "VEREINFACHT",
    CONTROLS_SIMPLIFIED_DETAILS: "Rechter Stick dreht und beschleunigt relativ zum Heli.",
    CONTROLS_PROFESSIONAL: "PROFI",
    CONTROLS_PROFESSIONAL_DETAILS: "Rechter Stick: oben = vorw\xE4rts, unabh\xE4ngig von Ausrichtung.",
    MUSIC_HEADING: "MUSIK",
    SFX_HEADING: "SOUND-EFFEKTE",
    AUDIO_ON: "AN",
    AUDIO_OFF: "AUS",
    PAUSE_TITLE: "\u2014 PAUSE \u2014",
    PAUSE_RESUME: "\u25B6 WEITER",
    PAUSE_ABORT: "\u2715 ABBRUCH",
    LANGUAGE_HEADING: "SPRACHE",
    TUT_ENGINE_D: "MOTOR STARTEN \u2014 DR\xDCCKE [W]",
    TUT_ENGINE_M: "MOTOR STARTEN \u2014 LINKEN STICK NACH OBEN",
    TUT_CLIMB_D: "AUFSTEIGEN \u2014 MINDESTENS 5 METER H\xD6HE ERREICHEN",
    TUT_CLIMB_M: "AUFSTEIGEN \u2014 LINKEN STICK HOCHHALTEN",
    TUT_STRAFE_D: "GLEITEN \u2014 MIT [A] UND [D] SEITW\xC4RTS BEWEGEN",
    TUT_STRAFE_M: "GLEITEN \u2014 LINKEN STICK NACH LINKS ODER RECHTS",
    TUT_STEER_H_D: "STEUERN \u2014 [\u2190][\u2192] DREHEN, [\u2191][\u2193] BESCHLEUNIGEN",
    TUT_STEER_H_M: "VEREINFACHT \u2014 STICK IN RICHTUNG DES HELIKOPTERS DR\xDCCKEN",
    TUT_STEER_S_D: "STEUERN \u2014 [\u2190][\u2192] DREHEN, [\u2191][\u2193] BESCHLEUNIGEN",
    TUT_STEER_S_M: "PROFI \u2014 STICK HOCH = VORW\xC4RTS, LINKS/RECHTS = DREHEN",
    TUT_LAND_D: "TANK FAST LEER \u2014 ZUR\xDCCK ZUM LANDEPLATZ UND LANDEN [S]",
    TUT_LAND_M: "TANK FAST LEER \u2014 ZUR\xDCCK ZUM LANDEPLATZ UND LANDEN",
    TUT_REFUEL: "WARTEN \u2014 TANKWAGEN BETANKT DEN HELIKOPTER",
    TUT_LOCATE_PERSON: "PERSON SUCHEN \u2014 MINIMAP NUTZEN UND ANN\xC4HERN",
    TUT_WINCH_DOWN_D: "WINDE ABSENKEN \u2014 [E] DR\xDCCKEN UND \xDCBER PERSON SCHWEBEN",
    TUT_WINCH_DOWN_M: "WINDE ABSENKEN \u2014 PITCH-RAD NACH UNTEN DREHEN",
    TUT_WINCH_UP_D: "EINWINSCHEN \u2014 [Q] DR\xDCCKEN",
    TUT_WINCH_UP_M: "EINWINSCHEN \u2014 PITCH-RAD NACH OBEN DREHEN",
    TUT_DELIVER_PERSON_D: "ABSETZEN \u2014 DELIVER-TOGGLE ODER [LEERTASTE]",
    TUT_DELIVER_PERSON_M: "ABSETZEN \u2014 DELIVER-TOGGLE BET\xC4TIGEN",
    TUT_LOCATE_CRATE: "KISTE SUCHEN \u2014 MINIMAP NUTZEN UND ANN\xC4HERN",
    TUT_DELIVER_CRATE_D: "KISTE ABSETZEN \u2014 DELIVER-TOGGLE ODER [LEERTASTE]",
    TUT_DELIVER_CRATE_M: "KISTE ABSETZEN \u2014 DELIVER-TOGGLE BET\xC4TIGEN",
    TUT_DONE: "TUTORIAL ABGESCHLOSSEN \u2014 VIEL ERFOLG!",
    CAMPAIGN_SWITCH_PROGRESS_WARN: "Der Fortschritt der aktiven Kampagne wird gel\xF6scht.",
    MENU_LEGAL: "RECHTLICHES",
    LEGAL_TITLE: "RECHTLICHES",
    LEGAL_IMPRESSUM_HEADING: "IMPRESSUM",
    LEGAL_DATENSCHUTZ_HEADING: "DATENSCHUTZ",
    LEGAL_IMPRESSUM: [
      "Angaben gem\xE4\xDF \xA7 5 TMG / DDG:",
      "",
      "Michael Draws-Beer",
      "Friedrichstrasse 46",
      "53332",
      "Deutschland",
      "",
      "Kontakt",
      "E-Mail: yarrick@web.de",
      "",
      "Inhaltlich Verantwortlicher gem\xE4\xDF \xA7 18 Abs. 2 MStV:",
      "Michael Draws-Beer \u2013 Anschrift wie oben"
    ],
    ..._IS_APP2 ? {
      LEGAL_DATENSCHUTZ: _DATENSCHUTZ_DE
    } : {
      LEGAL_DATENSCHUTZ: [
        "SAR: Callsign WOLF speichert folgende Daten ausschlie\xDFlich lokal auf deinem Ger\xE4t \u2013 und nur mit deiner Einwilligung:",
        "\u25B8 Rufzeichen  \u25B8 Dienstgrad  \u25B8 Kampagnenfortschritt  \u25B8 Einwilligungsstatus  \u25B8 Spracheinstellung",
        "Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung). Gespeicherte Daten k\xF6nnen jederzeit \xFCber Hauptmen\xFC \u2192 Einstellungen \u2192 Spielstand l\xF6schen gel\xF6scht werden.",
        "Die Steuerungseinstellung wird unabh\xE4ngig von der Einwilligung immer lokal gespeichert (rein technische Ger\xE4teeinstellung, kein Personenbezug).",
        "Es findet keine Weitergabe von Daten an Dritte statt.",
        "Kontakt f\xFCr Datenschutzanfragen: yarrick@web.de"
      ],
      LEGAL_DATENSCHUTZ_WEB: "Beim Aufbau einer Multiplayer-Verbindung werden zur Vermittlung der Peer-to-Peer-Verbindung Google STUN-Server (stun.l.google.com) kontaktiert. Dabei wird deine IP-Adresse \xFCbermittelt \u2013 ausschlie\xDFlich auf deine Veranlassung und nur f\xFCr die Dauer des Verbindungsaufbaus. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO."
    },
    MADE_WITH: "MADE WITH \u2665 IN JAVASCRIPT",
    COPYRIGHT: "\xA9 2026 i.thie softworks \u2014 Alle Rechte vorbehalten.",
    CREDITS_ROLE_DEVELOPMENT: "SPIELDESIGN & ENTWICKLUNG",
    CREDITS_ROLE_CAMPAIGN: "KAMPAGNEN-DESIGN",
    CREDITS_ROLE_SOUND: "SOUND & MUSIK",
    CREDITS_ROLE_RECORDING: "AUFNAHMELEITUNG",
    CREDITS_ROLE_VOICEARTIST: "SPRECHER",
    CREDITS_ROLE_LEADERTEST: "LEITER TEST",
    CREDITS_ROLE_TEST: "TESTER",
    CREDITS_ROLE_CONSULTGS: "FACHBERATUNG G.S.",
    CREDITS_ROLE_INSPIREDBY: "INSPIRIERT VON"
  };
  var _EN = {
    DONE: "complete",
    OUT_OF_FUEL: "OUT OF FUEL!",
    MAX_ALTITUDE: "MAX. ALTITUDE",
    CARGO_SECURED: "CARGO SECURED!",
    PATIENT_SECURED: "PATIENT SECURED!",
    DELIVERED: "DELIVERED!",
    ONBOARD: (n, max) => `ON BOARD [${n}/${max}]`,
    CABIN_FULL: "CABIN FULL!",
    DROP_AT_PAD: "DROP AT LANDING PAD!",
    SECURED: (rescued, total) => `SECURED: ${rescued}/${total}`,
    SOARING: "SOARING HIGH \u2013 \u2191\u2193 PITCH  \u2190\u2192 BANK",
    ...!_IS_APP2 ? { PARTY_ON: "\u{1F389} PARTY MODE \u{1F389}", UNLOCK_ALL: "\u{1F513} ALL CAMPAIGNS UNLOCKED" } : {},
    SPLASH_TITLE: "SAR: CALLSIGN WOLF",
    SPLASH_HINT: "CLICK TO START",
    MENU_TITLE: "SAR: CALLSIGN WOLF",
    MENU_SUBTITLE: "MAIN SYSTEM",
    MENU_START: "START GAME",
    ...!_IS_APP2 ? {
      MENU_MULTIPLAYER: "MULTIPLAYER",
      MP_SUBTITLE: "CO-OP MISSION",
      MP_CREATE: "CREATE GAME",
      MP_JOIN: "JOIN",
      MP_GENERATING: "GENERATING...",
      MP_WAIT_ANSWER: "WAITING FOR ANSWER...",
      MP_WAIT_CONNECT: "WAITING FOR CONNECTION...",
      MP_CONNECTING: "CONNECTING...",
      MP_CONNECTED: "CONNECTED",
      MP_ERROR: "ERROR \u2013 PLEASE TRY AGAIN",
      MP_READY_PROMPT: "READY FOR DEPLOYMENT?",
      MP_READY_BTN: "READY",
      MP_WAIT_READY: "WAITING FOR OTHER PLAYER...",
      MP_COPY: "COPY",
      MP_CONNECT: "CONNECT",
      MP_GEN_ANSWER: "GENERATE ANSWER",
      MP_STEP1_HOST: "Step 1: Send this code to your co-pilot:",
      MP_STEP2_HOST: "Step 2: Paste your co-pilot's answer:",
      MP_STEP1_GUEST: "Paste the host's code:",
      MP_STEP2_GUEST: "Send this code to the host:",
      MP_PASTE_HINT: "Paste code here\u2026",
      CRASH_REMOTE_HELI: "COLLISION WITH CO-PILOT"
    } : {},
    MENU_HELI: "HELICOPTER",
    MENU_SETTINGS: "SETTINGS",
    MENU_CREDITS: "CREDITS",
    NEXT: "Continue",
    BACK: "\u25C0 BACK",
    RETRY: "RETRY",
    RETURN_TO_BASE: "RETURN TO BASE",
    CAMPAIGN_SELECT_TITLE: "SELECT CAMPAIGN",
    CAMPAIGN_SELECT_SUB: "AREA OF OPERATION",
    CAMPAIGN_SELECT_MISSIONS: "Missions",
    MISSION_SELECT_SUB: "MISSIONS",
    MISSION_LOCKED: "[ LOCKED ]",
    BEST_TIME: (ms) => {
      const totalSec = ms / 1e3;
      const min = Math.floor(totalSec / 60);
      const sec = (totalSec % 60).toFixed(1);
      return `BEST TIME: ${min}:${sec.padStart(4, "0")}`;
    },
    CAMPAIGN_SWITCH_WARNING: "Progress will be reset.",
    CAMPAIGN_SWITCH_CONFIRM: "SWITCH ANYWAY",
    HELI_SELECT_TITLE: "HANGAR",
    HELI_SELECT_SUB: "SELECT AIRCRAFT",
    HELI_SELECT_CONFIRM: "SELECT",
    HELI_LOCKED_FROM: (rank) => `from ${rank}`,
    TERMINATED: "TERMINATED",
    MISSION_COMPLETE: "MISSION COMPLETE",
    OBJECTIVES_CLEARED: "ALL OBJECTIVES CLEARED",
    CAMPAIGN_COMPLETE: "CAMPAIGN COMPLETE",
    ALL_MISSIONS_CLEARED: "ALL MISSIONS CLEARED",
    CAMPAIGN_FAILED: "CAMPAIGN FAILED",
    MISSION_ABORTED: "MISSION ABORTED",
    CLICK_TO_DEPLOY: "CLICK TO DEPLOY",
    PILOT_ADDRESS: (rank, callsign) => `${rank} ${callsign || "WOLF"}`,
    BRIEFING_ADDRESS: (rank, callsign) => `Your mission, ${rank} ${callsign || "WOLF"}`,
    SAVE_CODE_INVALID: "INVALID CODE",
    SAVE_CODE_LOADED: "SAVE LOADED",
    NO_SAVE_STATE: "  |  NO SAVE STATE",
    STATS: (c, m) => `CAMPAIGNS: ${c}  |  MISSIONS: ${m}`,
    CAMPAIGN_LOCKED: "[ LOCKED ]",
    DELETE_SESSION: "DELETE SAVE",
    DELETE_CONFIRM: "REALLY DELETE?",
    SESSION_DELETED: "DELETED \u2013 RELOADING\u2026",
    DELIVER_MODE_ON: "DEPLOY MODE \u2014 [R] CANCEL",
    DELIVER_MODE_OFF: "",
    DELIVERED_TO_ZONE: "PERSON DEPLOYED!",
    DELIVER_NO_ZONE: "NO DEPLOY ZONE HERE",
    CRASH_WATER: "WATER IMPACT",
    CRASH_BAD_ZONE: "WRONG LANDING ZONE",
    CRASH_TOO_FAST: "TOO FAST",
    CRASH_HARD_IMPACT: "HARD IMPACT",
    CRASH_CARRIER_TOWER: "CARRIER TOWER COLLISION",
    CRASH_PARKED_HELI: "COLLISION WITH PARKED HELI",
    CRASH_HANGAR: "HANGAR COLLISION",
    CRASH_TOWER: "TOWER COLLISION",
    CRASH_FUEL_TRUCK: "FUEL TRUCK COLLISION",
    CRASH_LIGHTHOUSE: "LIGHTHOUSE COLLISION",
    CRASH_BOAT: "BOAT COLLISION",
    CRASH_SUBMARINE: "SUBMARINE COLLISION",
    CRASH_TREE: "TREE CONTACT",
    WHATS_NEW_HEADLINE: "WHAT'S NEW",
    WHATS_NEW_VERSION: "v27.0.0",
    WHATS_NEW_TITLE: "Campaign: Callsign Wolf",
    WHATS_NEW_HINT: "CLICK TO CONTINUE",
    WHATS_NEW_ITEMS: ["Now available as a native iOS app", "\u{1F43A} Demo campaign available: Callsign Wolf", "\u{1FAA6} R.I.P. _isMobile \u2014 you will not be missed"],
    PILOT_HEADING: "PROFILE",
    PILOT_CALLSIGN: "CALLSIGN (MAX. 8 CHARS, A\u2013Z)",
    PILOT_SAVECODE: "SAVE CODE",
    PILOT_IMPORT: "IMPORT CODE (OVERWRITES SAVE)",
    PILOT_IMPORTLOAD: "LOAD",
    CONTROLS_HEADING: "CONTROLS",
    CONTROLS_SIMPLIFIED: "SIMPLIFIED",
    CONTROLS_SIMPLIFIED_DETAILS: "Right stick rotates and accelerates relative to the heli.",
    CONTROLS_PROFESSIONAL: "PROFESSIONAL",
    CONTROLS_PROFESSIONAL_DETAILS: "Right stick: up = forward, independent of heading.",
    MUSIC_HEADING: "MUSIC",
    SFX_HEADING: "SOUND EFFECTS",
    AUDIO_ON: "ON",
    AUDIO_OFF: "OFF",
    PAUSE_TITLE: "\u2014 PAUSED \u2014",
    PAUSE_RESUME: "\u25B6 RESUME",
    PAUSE_ABORT: "\u2715 ABORT",
    TUT_ENGINE_D: "START ENGINE \u2014 PRESS [W]",
    TUT_ENGINE_M: "START ENGINE \u2014 PUSH LEFT STICK UP",
    TUT_CLIMB_D: "CLIMB \u2014 REACH AT LEAST 5 METRES",
    TUT_CLIMB_M: "CLIMB \u2014 HOLD LEFT STICK UP",
    TUT_STRAFE_D: "STRAFE \u2014 MOVE SIDEWAYS WITH [A] AND [D]",
    TUT_STRAFE_M: "STRAFE \u2014 PUSH LEFT STICK LEFT OR RIGHT",
    TUT_STEER_H_D: "STEER \u2014 [\u2190][\u2192] TURN, [\u2191][\u2193] ACCELERATE",
    TUT_STEER_H_M: "SIMPLIFIED \u2014 PUSH STICK IN HELI DIRECTION",
    TUT_STEER_S_D: "STEER \u2014 [\u2190][\u2192] TURN, [\u2191][\u2193] ACCELERATE",
    TUT_STEER_S_M: "PROFESSIONAL \u2014 STICK UP = FORWARD, LEFT/RIGHT = TURN",
    TUT_LAND_D: "LOW FUEL \u2014 RETURN TO PAD AND LAND [S]",
    TUT_LAND_M: "LOW FUEL \u2014 RETURN TO PAD AND LAND",
    TUT_REFUEL: "WAIT \u2014 FUEL TRUCK IS REFUELLING THE HELICOPTER",
    TUT_LOCATE_PERSON: "LOCATE SURVIVOR \u2014 USE MINIMAP AND APPROACH",
    TUT_WINCH_DOWN_D: "LOWER WINCH \u2014 PRESS [E] AND HOVER OVER SURVIVOR",
    TUT_WINCH_DOWN_M: "LOWER WINCH \u2014 ROLL PITCH WHEEL DOWN",
    TUT_WINCH_UP_D: "RAISE WINCH \u2014 PRESS [Q]",
    TUT_WINCH_UP_M: "RAISE WINCH \u2014 ROLL PITCH WHEEL UP",
    TUT_DELIVER_PERSON_D: "SET DOWN \u2014 DELIVER TOGGLE OR [SPACE]",
    TUT_DELIVER_PERSON_M: "SET DOWN \u2014 USE DELIVER TOGGLE",
    TUT_LOCATE_CRATE: "FIND CRATE \u2014 USE MINIMAP AND APPROACH",
    TUT_DELIVER_CRATE_D: "RELEASE CRATE \u2014 DELIVER TOGGLE OR [SPACE]",
    TUT_DELIVER_CRATE_M: "RELEASE CRATE \u2014 USE DELIVER TOGGLE",
    TUT_DONE: "TUTORIAL COMPLETE \u2014 GOOD LUCK!",
    LANGUAGE_HEADING: "LANGUAGE",
    CAMPAIGN_SWITCH_PROGRESS_WARN: "Progress of the active campaign will be deleted.",
    MENU_LEGAL: "LEGAL",
    LEGAL_TITLE: "LEGAL NOTICE",
    LEGAL_IMPRESSUM_HEADING: "IMPRINT",
    LEGAL_DATENSCHUTZ_HEADING: "PRIVACY POLICY",
    LEGAL_IMPRESSUM: [
      "Information according to \xA7 5 TMG / DDG:",
      "",
      "Michael Draws-Beer",
      "Friedrichstrasse 46",
      "53332",
      "Germany",
      "",
      "Contact",
      "Email: yarrick@web.de",
      "",
      "Responsible for content (\xA7 18 para. 2 MStV):",
      "Michael Draws-Beer \u2013 address as above"
    ],
    ..._IS_APP2 ? {
      LEGAL_DATENSCHUTZ: _DATENSCHUTZ_EN
    } : {
      LEGAL_DATENSCHUTZ: [
        "SAR: Callsign WOLF stores the following data exclusively locally on your device \u2013 and only with your consent:",
        "\u25B8 Callsign  \u25B8 Rank  \u25B8 Campaign progress  \u25B8 Consent status  \u25B8 Language setting",
        "Legal basis: Art. 6 para. 1 lit. a GDPR (consent). Stored data can be deleted at any time via Main Menu \u2192 Settings \u2192 Delete Save.",
        "The control setting is always stored locally regardless of consent (purely technical device setting, no personal data).",
        "No data is shared with third parties.",
        "Privacy contact: yarrick@web.de"
      ],
      LEGAL_DATENSCHUTZ_WEB: "When establishing a multiplayer connection, Google STUN servers (stun.l.google.com) are contacted to broker the peer-to-peer connection. Your IP address is transmitted \u2013 solely at your initiative and only for the duration of the connection setup. Legal basis: Art. 6 para. 1 lit. b GDPR."
    },
    MADE_WITH: "MADE WITH \u2665 IN JAVASCRIPT",
    COPYRIGHT: "\xA9 2026 i.thie softworks \u2014 All rights reserved.",
    CREDITS_ROLE_DEVELOPMENT: "GAME DESIGN & DEVELOPMENT",
    CREDITS_ROLE_CAMPAIGN: "CAMPAIGN DESIGN",
    CREDITS_ROLE_SOUND: "SOUND & MUSIC",
    CREDITS_ROLE_RECORDING: "AUDIO-RECORDING",
    CREDITS_ROLE_VOICEARTIST: "VOICE-ARTIST",
    CREDITS_ROLE_LEADERTEST: "LEADER-TESTER",
    CREDITS_ROLE_TEST: "TESTERS",
    CREDITS_ROLE_CONSULTGS: "CONSULTING G.S.",
    CREDITS_ROLE_INSPIREDBY: "INSPIRED BY"
  };
  var _lang0 = _detectLang();
  var I18N = _lang0 === "de" ? _DE : _EN;
  var LANG = _lang0;
  var _langCallbacks = [];
  var onLanguageChange = (cb) => {
    _langCallbacks.push(cb);
  };
  var setLanguage = (lang) => {
    storageSet(LANG_PREF_KEY, lang);
    LANG = lang;
    I18N = lang === "de" ? _DE : _EN;
    _langCallbacks.forEach((cb) => cb());
  };
  var localize = (ls) => {
    if (!ls) return "";
    if (typeof ls === "string") return ls;
    return LANG === "en" && ls.en ? ls.en : ls.de;
  };

  // ../src/game/ui/dom-helpers.ts
  var ensureEl = (id) => {
    let el2 = document.getElementById(id);
    if (!el2) {
      el2 = document.createElement("div");
      el2.id = id;
      document.body.appendChild(el2);
    }
    return el2;
  };

  // ../src/game/ui/nav.ts
  var NAV_SCREENS = [
    "splash",
    "main-menu",
    "campaign-select",
    "mission-select",
    "heli-select",
    "credits-screen",
    "settings-screen",
    "legal-screen"
  ];
  var showScreen = (id) => {
    NAV_SCREENS.forEach((s) => {
      const el2 = document.getElementById(s);
      if (!el2) return;
      if (s === id) {
        el2.style.display = "flex";
        el2.scrollTop = 0;
      } else {
        el2.style.display = "none";
      }
    });
  };
  var showScreenCrtEnter = (id) => {
    showScreen(id);
    const el2 = document.getElementById(id);
    if (!el2) return;
    el2.classList.remove("crt-entering");
    requestAnimationFrame(() => {
      el2.classList.add("crt-entering");
      setTimeout(() => el2.classList.remove("crt-entering"), 380);
    });
  };

  // ../src/game/ui/back-button/back-button.css
  var __el4 = document.createElement("style");
  __el4.textContent = "@keyframes crtCollapse {\n    0%   { transform: scaleY(1)     scaleX(1);    filter: brightness(1); }\n    50%  { transform: scaleY(0.012) scaleX(1);    filter: brightness(4); }\n    72%  { transform: scaleY(0.012) scaleX(0.35); filter: brightness(2.5); }\n    88%  { transform: scaleY(0.012) scaleX(0.04); filter: brightness(5); }\n    100% { transform: scaleY(0.012) scaleX(0);    filter: brightness(0); }\n}\n\n.ui-screen.crt-leaving {\n    animation: crtCollapse 380ms cubic-bezier(0.4, 0, 1, 1) forwards;\n    pointer-events: none;\n}\n\n@keyframes crtExpand {\n    0%   { transform: scaleY(0.012) scaleX(0);    filter: brightness(0); }\n    12%  { transform: scaleY(0.012) scaleX(0.04); filter: brightness(5); }\n    28%  { transform: scaleY(0.012) scaleX(0.35); filter: brightness(2.5); }\n    50%  { transform: scaleY(0.012) scaleX(1);    filter: brightness(4); }\n    100% { transform: scaleY(1)     scaleX(1);    filter: brightness(1); }\n}\n\n.ui-screen.crt-entering {\n    animation: crtExpand 380ms cubic-bezier(0, 0, 0.6, 1) forwards;\n}\n\n.back-btn {\n    font-size: 13px;\n    letter-spacing: 4px;\n    color: #666;\n    cursor: pointer;\n    padding: 10px 28px;\n    border: 1px solid #444;\n    transition: all 0.2s;\n    margin-top: 28px;\n    display: inline-block;\n}\n.back-btn:hover {\n    color: #aaa;\n    border-color: #555;\n    text-shadow: 0 0 8px rgba(255, 255, 255, 0.15);\n}\n@media (max-height: 520px) {\n    .back-btn {\n        margin-top: 10px;\n        padding: 8px 20px;\n    }\n}\n";
  document.head.appendChild(__el4);

  // ../src/game/ui/back-button/back-button.ts
  var createBackButton = (onClick) => {
    const btn = document.createElement("div");
    btn.className = "back-btn";
    btn.textContent = I18N.BACK;
    btn.addEventListener("click", () => {
      const screen2 = btn.closest(".ui-screen");
      if (screen2) {
        screen2.classList.add("crt-leaving");
        setTimeout(() => {
          screen2.classList.remove("crt-leaving");
          onClick();
        }, 380);
      } else {
        onClick();
      }
    });
    return btn;
  };

  // ../src/game/ui/screen-shell/screen-shell.ts
  var mountScreenShell = (id, title, subtitle, onBack) => {
    const root = ensureEl(id);
    root.classList.add("ui-screen");
    root.innerHTML = `
        <div class="title">${title}</div>
        ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
        <div class="screen-body"></div>`;
    if (onBack) root.appendChild(createBackButton(onBack));
    return root.querySelector(".screen-body");
  };

  // ../src/game/ui/main-menu/main-menu.ui.ts
  var _IS_APP3 = false;
  var _splashHandler = null;
  var _menuIntroPlayed = false;
  var _menuItemTexts = [];
  var _audioCtx = null;
  var _typeBeep = () => {
    try {
      if (!_audioCtx) _audioCtx = new AudioContext();
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.connect(gain);
      gain.connect(_audioCtx.destination);
      osc.type = "square";
      osc.frequency.value = 520;
      gain.gain.setValueAtTime(0.05, _audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1e-3, _audioCtx.currentTime + 0.04);
      osc.start(_audioCtx.currentTime);
      osc.stop(_audioCtx.currentTime + 0.04);
    } catch {
    }
  };
  var mount = (cb) => {
    const splash = ensureEl("splash");
    if (_splashHandler) {
      splash.removeEventListener("click", _splashHandler);
      _splashHandler = null;
    }
    splash.classList.add("ui-screen");
    splash.innerHTML = `<p class="start-hint">${I18N.SPLASH_HINT}</p>`;
    const ithie = ensureEl("ithie-splash");
    ithie.innerHTML = `<span class="ithie-text" id="ithie-text"></span><span class="ithie-cursor">_</span>`;
    const logo = ensureEl("logo-splash");
    logo.innerHTML = `<span class="ithie-text" id="logo-splash-text"></span><span class="ithie-cursor">_</span>`;
    const _typewrite = (el2, text) => {
      el2.textContent = "";
      let i = 0;
      const tick = () => {
        if (i < text.length) {
          el2.textContent += text[i++];
          _typeBeep();
          setTimeout(tick, 65);
        }
      };
      tick();
    };
    const _handleSplashClick = () => {
      splash.removeEventListener("click", _handleSplashClick);
      _splashHandler = null;
      splash.classList.add("splash-clicked");
      setTimeout(() => {
        showScreen(null);
        splash.classList.remove("splash-clicked");
        ithie.style.display = "flex";
        ithie.style.transition = "opacity 500ms ease";
        ithie.getBoundingClientRect();
        ithie.style.opacity = "1";
        _typewrite(document.getElementById("ithie-text"), "i.thie softworks.");
      }, 350);
      setTimeout(() => {
        ithie.style.transition = "filter 140ms ease-out";
        ithie.getBoundingClientRect();
        ithie.style.filter = "brightness(4)";
      }, 2e3);
      setTimeout(() => {
        ithie.style.transition = "filter 280ms ease-in";
        ithie.style.filter = "brightness(0)";
      }, 2140);
      setTimeout(() => {
        ithie.style.display = "none";
        ithie.style.filter = "";
        ithie.style.transition = "";
        logo.style.display = "flex";
        logo.style.opacity = "0";
        logo.style.transition = "opacity 380ms ease";
        logo.getBoundingClientRect();
        logo.style.opacity = "1";
        _typewrite(document.getElementById("logo-splash-text"), "To old rekindling flames...");
      }, 2900);
      setTimeout(() => {
        logo.style.transition = "opacity 380ms ease";
        logo.style.opacity = "0";
      }, 2900 + 380 + 3800);
      setTimeout(() => {
        logo.style.display = "none";
        logo.style.opacity = "";
        logo.style.transition = "";
        _splashHandler = _handleSplashClick;
        splash.addEventListener("click", _handleSplashClick);
        cb.onSplashClick();
      }, 2900 + 380 + 3800 + 380);
    };
    _splashHandler = _handleSplashClick;
    splash.addEventListener("click", _handleSplashClick);
    const menuBody = mountScreenShell("main-menu", I18N.MENU_TITLE, I18N.MENU_SUBTITLE);
    const menuRoot = document.getElementById("main-menu");
    const bgCanvas = document.createElement("canvas");
    bgCanvas.id = "main-menu-bg-canvas";
    menuRoot.insertBefore(bgCanvas, menuRoot.firstChild);
    menuBody.innerHTML = `
        <nav class="menu-nav">
            <div class="menu-item" id="menu-item-start">${I18N.MENU_START}</div>
            ${!_IS_APP3 && cb.onMultiplayer ? `<div class="menu-item" id="menu-item-multiplayer">${I18N.MENU_MULTIPLAYER}</div>` : ""}
            <div class="menu-item" id="menu-item-settings">${I18N.MENU_SETTINGS}</div>
            <div class="menu-item" id="menu-item-credits">${I18N.MENU_CREDITS}</div>
        </nav>
        <div id="menu-item-legal" class="menu-legal-link">${I18N.MENU_LEGAL}</div>`;
    _menuItemTexts = Array.from(
      document.querySelectorAll("#main-menu .menu-item")
    ).map((el2) => ({ el: el2, text: el2.textContent ?? "" }));
    if (!_menuIntroPlayed) {
      _menuItemTexts.forEach(({ el: el2 }) => {
        el2.textContent = "";
      });
      const menuEl = document.getElementById("main-menu");
      const obs = new MutationObserver(() => {
        if (menuEl.style.display !== "none" && !_menuIntroPlayed) {
          _menuIntroPlayed = true;
          obs.disconnect();
          _menuItemTexts.forEach(({ el: el2, text }) => {
            let i = 0;
            const type = () => {
              if (i < text.length) {
                el2.textContent += text[i++];
                _typeBeep();
                setTimeout(type, 40);
              }
            };
            setTimeout(type, 60);
          });
        }
      });
      obs.observe(menuEl, { attributes: true, attributeFilter: ["style"] });
    }
    document.getElementById("menu-item-start").addEventListener("click", cb.onStart);
    if (!_IS_APP3) document.getElementById("menu-item-multiplayer")?.addEventListener("click", cb.onMultiplayer);
    document.getElementById("menu-item-settings").addEventListener("click", cb.onSettings);
    document.getElementById("menu-item-credits").addEventListener("click", cb.onCredits);
    document.getElementById("menu-item-legal").addEventListener("click", cb.onLegal);
  };

  // ../src/game/ui/briefing/briefing.css
  var __el5 = document.createElement("style");
  __el5.textContent = "#mission-briefing {\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    background: transparent;\n    display: none;\n    justify-content: center;\n    align-items: center;\n    z-index: 300;\n}\n\n#briefing-panel {\n    display: flex;\n    flex-direction: row;\n    align-items: flex-end;\n    gap: 20px;\n    padding: 0 24px;\n    max-width: 700px;\n    width: 100%;\n    box-sizing: border-box;\n}\n\n#briefing-commander-img {\n    flex-shrink: 0;\n    height: clamp(140px, 32vh, 260px);\n    width: auto;\n    align-self: flex-end;\n}\n\n#briefing-text {\n    flex: 1;\n    display: flex;\n    flex-direction: column;\n    gap: 10px;\n    background: rgba(2, 8, 2, 0.94);\n    border: 1px solid #1a1a1a;\n    border-left: 2px solid #ff6600;\n    padding: 18px 22px;\n    box-shadow: -6px 6px 30px rgba(0, 0, 0, 0.8);\n    min-width: 0;\n}\n\n#briefing-address {\n    font-size: 11px;\n    color: #cc9900;\n    letter-spacing: 3px;\n    margin-bottom: 2px;\n}\n\n#briefing-headline {\n    font-size: 22px;\n    color: #ff6600;\n    text-shadow: 0 0 10px #ff6600;\n    font-weight: bold;\n    letter-spacing: 2px;\n}\n\n#briefing-sublines {\n    font-size: 12px;\n    color: #5f5;\n    line-height: 1.8;\n    letter-spacing: 1px;\n}\n\n#briefing-body {\n    font-size: 12px;\n    color: #aaa;\n    line-height: 1.7;\n    border-left: 2px solid #333;\n    padding-left: 12px;\n}\n\n#briefing-ok-btn {\n    align-self: flex-end;\n    margin-top: 6px;\n    font-family: monospace;\n    font-size: 13px;\n    letter-spacing: 3px;\n    color: #0f0;\n    background: transparent;\n    border: 1px solid #0f0;\n    padding: 7px 22px;\n    cursor: pointer;\n    animation: blink 1s infinite;\n    -webkit-tap-highlight-color: transparent;\n}\n\n#briefing-ok-btn:hover {\n    background: rgba(0, 255, 0, 0.1);\n}\n\n@media (max-height: 480px) {\n    #briefing-panel {\n        gap: 12px;\n        padding: 0 12px;\n    }\n    #briefing-commander-img {\n        height: clamp(110px, 28vh, 180px);\n    }\n    #briefing-text {\n        padding: 10px 14px;\n        gap: 6px;\n    }\n    #briefing-headline {\n        font-size: 17px;\n    }\n    #briefing-address {\n        font-size: 10px;\n        letter-spacing: 2px;\n    }\n    #briefing-sublines,\n    #briefing-body {\n        font-size: 11px;\n    }\n    #briefing-ok-btn {\n        font-size: 12px;\n        padding: 5px 16px;\n    }\n}\n";
  document.head.appendChild(__el5);

  // ../src/game/ui/briefing/briefing.ui.ts
  var _COMMODORE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 710 1070" style="height:100%;width:auto;display:block;">
    <path fill="#6a3010" fill-rule="evenodd" d="M 357,0 303,5 278,15 254,33 243,48 233,73 230,91 233,144 225,159 228,205 240,228 244,252 262,297 265,291 248,257 242,225 232,213 226,169 228,155 235,149 233,82 244,50 270,22 289,12 322,3 370,3 395,9 413,18 430,32 455,65 461,97 456,149 465,155 468,163 466,189 459,210 449,224 431,231 425,270 425,276 430,278 428,259 433,233 448,227 458,216 469,182 469,159 459,147 463,107 460,73 448,50 418,19 389,5 357,1 Z M 356,9 306,14 284,22 266,34 246,62 239,98 241,125 247,86 265,64 305,77 339,77 376,69 410,42 421,41 415,29 395,17 356,10 Z M 429,287 424,322 397,369 432,357 463,355 464,358 465,352 461,324 429,288 Z M 475,334 472,335 470,363 451,387 370,417 342,441 324,472 325,475 354,444 373,431 453,401 464,392 474,376 551,406 578,421 578,426 597,405 611,397 612,394 602,388 580,411 575,412 550,397 481,370 476,367 477,358 492,341 475,335 Z M 512,340 492,351 485,363 536,382 574,403 603,380 590,371 569,392 565,392 556,386 577,366 570,362 551,382 544,381 539,375 557,357 550,355 532,373 523,372 519,367 541,349 512,341 Z M 201,342 178,349 179,360 175,369 163,372 164,355 157,356 158,368 154,377 142,380 143,363 134,365 135,383 123,388 122,372 114,377 111,390 113,398 129,388 195,368 201,343 Z M 222,390 232,405 255,418 281,441 301,475 290,446 275,423 258,408 222,391 Z M 620,402 596,416 600,417 590,515 563,619 559,571 569,536 577,483 566,495 542,545 540,629 558,715 578,784 576,881 577,866 592,838 587,806 626,755 648,719 647,714 641,715 592,745 574,667 597,584 618,469 656,587 681,718 675,740 639,787 632,804 643,805 686,791 644,1070 669,1070 670,1066 693,939 702,822 701,747 673,564 655,490 632,424 620,403 Z M 514,481 362,626 361,721 361,788 382,787 383,637 511,516 509,579 491,621 483,660 472,743 468,808 466,811 443,812 522,807 547,696 532,627 538,525 514,482 Z M 138,489 126,511 223,635 219,785 240,785 243,667 242,623 138,490 Z M 320,509 314,558 309,568 310,579 310,569 322,566 320,510 Z M 112,546 117,647 126,717 123,718 94,674 90,675 90,682 94,704 118,769 107,771 73,761 57,761 60,770 106,813 111,826 91,834 89,841 71,940 60,1051 34,1051 85,1052 91,999 120,885 140,775 146,761 137,622 112,547 Z M 304,685 301,744 302,776 304,686 Z M 301,786 298,896 299,959 301,787 Z M 209,812 196,812 209,814 209,841 193,841 210,842 209,813 Z M 520,816 389,819 466,819 464,848 390,848 388,820 389,849 465,849 520,845 520,817 Z M 520,854 383,855 462,857 443,898 424,967 488,878 479,1070 547,1070 537,949 520,855 Z"/>
    <path fill="#1e0e06" fill-rule="evenodd" d="M 362,2 322,3 282,15 252,38 238,63 232,89 235,149 227,158 228,190 232,213 242,225 245,248 264,295 225,332 213,336 207,332 199,333 145,352 110,369 104,387 86,417 58,532 46,549 26,646 24,676 29,684 28,710 7,869 0,1011 0,1054 7,1059 7,1070 16,1070 17,1059 71,1060 77,1070 86,1070 85,1062 92,1058 99,1001 130,879 146,784 149,783 149,842 129,936 118,1024 115,1070 124,1070 134,959 156,846 217,848 216,807 156,800 144,618 109,510 101,461 98,410 102,402 111,406 200,374 207,347 221,342 215,361 218,387 234,399 264,412 280,429 300,468 304,496 304,501 297,508 288,552 291,563 302,565 296,677 291,956 291,1069 298,1070 302,709 309,568 314,558 318,528 318,493 328,462 350,432 381,411 441,393 463,375 473,354 472,335 475,334 492,341 477,358 476,367 481,370 550,397 575,412 580,411 602,388 612,396 588,413 565,444 550,477 539,518 532,586 532,627 547,703 522,807 468,812 384,812 382,854 520,854 537,949 547,1070 555,1070 546,953 528,851 530,806 552,717 570,785 567,856 576,978 568,1070 577,1070 583,999 583,932 575,861 578,784 558,715 540,629 542,545 554,489 570,451 598,414 620,402 638,439 669,544 701,747 702,822 693,939 669,1066 669,1070 677,1070 700,949 709,841 710,772 698,662 681,562 665,494 638,418 628,399 614,386 612,374 583,358 528,337 512,332 497,335 470,324 441,288 425,276 431,231 451,222 466,189 468,163 465,155 456,149 461,108 458,74 449,54 419,22 395,9 362,3 Z M 355,9 395,17 415,29 421,41 410,42 376,69 339,77 305,77 265,64 247,86 241,125 241,78 249,55 259,41 291,19 319,11 354,9 Z M 269,73 305,85 349,83 377,75 395,76 407,90 406,127 418,151 421,186 433,185 439,165 448,156 457,157 461,164 460,184 452,208 443,220 426,225 420,252 407,274 372,306 352,317 310,320 292,314 276,296 258,262 250,237 246,147 254,89 258,80 268,73 Z M 236,159 239,205 234,180 235,159 Z M 417,273 417,318 395,358 387,369 375,376 339,385 303,383 288,376 277,365 273,354 274,308 286,320 300,326 346,326 385,305 416,273 Z M 428,287 463,328 465,352 461,364 442,384 386,401 362,415 359,415 361,410 398,368 419,333 426,314 427,287 Z M 265,306 266,360 290,430 266,405 230,388 222,379 222,362 230,342 264,306 Z M 511,340 541,349 601,377 603,380 576,403 536,382 485,363 492,351 510,340 Z M 200,342 195,368 129,388 113,398 112,385 119,373 199,342 Z M 284,383 314,394 371,388 333,435 313,483 309,479 302,438 283,383 Z M 91,432 104,523 137,622 146,761 140,775 120,885 91,999 85,1052 8,1049 15,874 37,692 56,690 59,686 91,569 91,564 65,540 79,471 91,433 Z M 307,509 313,511 313,519 306,558 294,557 306,509 Z M 59,546 82,565 83,570 51,683 38,683 34,679 32,662 50,567 58,546 Z M 179,810 211,814 209,843 157,838 157,810 178,810 Z M 519,816 520,845 465,849 389,849 389,819 518,816 Z"/>
    <path fill="#a05428" fill-rule="evenodd" d="M 392,75 375,77 386,80 389,86 389,141 401,164 393,246 372,287 345,317 339,319 352,317 369,308 407,274 420,252 426,225 443,220 452,208 461,174 459,159 448,156 439,165 433,185 421,186 418,151 406,127 407,90 398,78 392,76 Z M 418,273 385,305 353,324 306,327 287,320 302,337 330,354 387,369 417,318 418,274 Z M 266,306 235,335 222,362 224,382 266,405 290,430 266,360 266,307 Z M 221,342 207,347 200,374 111,406 102,402 98,410 101,461 109,510 144,618 156,800 217,808 216,849 156,846 135,952 124,1070 290,1070 293,763 302,565 291,563 288,552 297,508 304,501 304,496 299,469 281,441 255,418 232,405 218,387 215,361 221,343 Z M 463,355 432,357 396,369 359,413 362,415 386,401 442,384 455,373 463,356 Z M 478,376 474,376 464,392 448,404 383,426 362,438 328,469 321,482 317,504 320,509 322,566 310,569 307,613 298,959 298,1070 479,1070 488,878 424,967 443,898 462,857 383,856 382,814 466,811 468,808 472,743 483,660 491,621 509,579 511,516 383,637 382,787 361,788 362,626 513,481 538,525 556,462 579,424 551,406 478,377 Z M 600,416 582,432 563,465 551,500 544,536 546,542 566,495 577,483 569,536 559,571 563,619 589,521 600,417 Z M 92,432 79,471 65,534 65,540 91,564 91,569 59,686 56,690 37,692 15,874 8,1029 10,1051 60,1051 71,940 89,841 91,834 111,826 106,813 57,765 59,760 68,760 107,771 118,769 94,704 91,674 103,686 123,718 126,717 117,647 112,549 98,494 92,433 Z M 619,469 597,584 574,667 592,745 641,715 647,714 648,719 626,755 587,806 592,838 577,866 583,932 583,999 577,1070 645,1068 686,803 686,791 682,791 643,805 632,804 639,787 675,740 681,718 656,587 619,470 Z M 137,489 243,625 239,786 219,785 223,635 126,511 136,489 Z M 308,509 303,511 294,552 295,558 308,555 313,519 313,511 308,510 Z M 60,546 55,549 50,567 32,662 32,676 38,683 53,681 83,570 83,566 60,547 Z M 180,810 157,810 157,838 209,841 209,814 180,811 Z M 466,819 389,820 390,848 464,848 466,820 Z"/>
    <path fill="#c89276" fill-rule="evenodd" d="M 270,73 265,73 258,80 252,99 246,147 247,209 250,237 258,262 276,296 292,314 307,320 339,319 364,297 390,256 401,186 401,164 389,141 390,92 386,80 372,77 349,83 305,85 270,74 Z M 275,308 273,354 277,365 288,376 311,385 339,385 370,378 386,369 345,360 318,348 302,337 275,309 Z M 37,1059 17,1059 16,1070 77,1070 71,1060 37,1060 Z"/>
    <path fill="#ffff00" fill-rule="evenodd" d="M 541,350 519,367 523,372 532,373 550,357 541,351 Z M 179,350 166,354 163,364 163,372 175,369 179,351 Z M 559,358 539,375 540,379 551,382 570,365 559,359 Z M 158,358 145,362 142,372 142,380 154,377 158,359 Z M 579,367 556,386 569,392 589,373 579,368 Z M 136,367 124,372 122,385 126,388 135,383 136,368 Z"/>
    <path fill="#eaeaea" fill-rule="evenodd" d="M 285,383 283,389 302,438 311,483 333,435 371,389 314,394 285,384 Z"/>
</svg>`;
  var mount2 = () => {
    ensureEl("mission-briefing");
  };
  var _onDismiss = null;
  var hide = () => {
    const el2 = document.getElementById("mission-briefing");
    if (el2) el2.style.display = "none";
  };
  var _dismiss = () => {
    hide();
    const cb = _onDismiss;
    _onDismiss = null;
    cb?.();
  };
  var show = (data, onDismiss) => {
    _onDismiss = onDismiss;
    const el2 = document.getElementById("mission-briefing");
    const sublinesHtml = Array.isArray(data.sublines) && data.sublines.length ? `<div id="briefing-sublines">${data.sublines.map((s) => `\u25B8 ${localize(s)}`).join("<br>")}</div>` : "";
    const bodyHtml = data.briefing ? `<div id="briefing-body">${localize(data.briefing)}</div>` : "";
    el2.innerHTML = `
        <div id="briefing-panel">
            <div id="briefing-text">
                <div id="briefing-address">${data.address}</div>
                <div id="briefing-headline">${localize(data.headline) || "MISSION BRIEFING"}</div>
                ${sublinesHtml}
                ${bodyHtml}
                <button id="briefing-ok-btn">OKAY</button>
            </div>
            <div id="briefing-commander-img">${_COMMODORE_SVG}</div>
        </div>`;
    document.getElementById("briefing-ok-btn").addEventListener("click", _dismiss);
    el2.style.display = "flex";
  };

  // ../src/game/ui/swipe-carousel/swipe-carousel.css
  var __el6 = document.createElement("style");
  __el6.textContent = ".swipe-carousel {\n    max-width: 900px;\n    width: calc(100% - max(40px, env(safe-area-inset-left, 0px)) - max(40px, env(safe-area-inset-right, 0px)));\n    margin: 0 auto;\n    overflow: hidden;\n    touch-action: pan-y manipulation;\n    position: relative;\n    box-sizing: border-box;\n}\n\n.swipe-track {\n    display: flex;\n    gap: 16px;\n    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);\n    will-change: transform;\n    user-select: none;\n    -webkit-user-select: none;\n}\n\n.swipe-track.dragging {\n    transition: none;\n}\n\n.swipe-card {\n    flex: 0 0 280px;\n    min-height: 220px;\n    background: rgba(0, 40, 15, 0.4);\n    border: 1px solid #3a3;\n    color: #6c6;\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    text-align: center;\n    font-size: 16px;\n    border-radius: 4px;\n    cursor: pointer;\n    padding: 14px 10px;\n    box-sizing: border-box;\n    position: relative;\n    overflow: hidden;\n    transition: border-color 0.2s, box-shadow 0.2s, color 0.2s, background 0.2s;\n}\n\n.swipe-card:hover:not(.locked) {\n    background: rgba(0, 60, 30, 0.9);\n    border-color: #5f5;\n    color: #fff;\n    box-shadow: 0 0 30px #ff6600;\n}\n\n.swipe-card.active {\n    border-color: #ff6600;\n    box-shadow: 0 0 22px rgba(255, 102, 0, 0.35);\n    color: #fff;\n}\n\n.swipe-card.locked {\n    opacity: 0.2;\n    cursor: not-allowed;\n    filter: grayscale(1);\n    border-color: #1a1a1a;\n}\n\n/* \u2500\u2500 full-screen overlay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n@keyframes morphIn {\n    0%   { transform: scale(0.08); opacity: 0; }\n    18%  { opacity: 1; filter: brightness(2.5); }\n    55%  { filter: brightness(1); }\n    100% { transform: scale(1);    opacity: 1; filter: brightness(1); }\n}\n\n@keyframes crtCollapse {\n    0%   { transform: scaleY(1)     scaleX(1);    filter: brightness(1); }\n    50%  { transform: scaleY(0.012) scaleX(1);    filter: brightness(4); }\n    72%  { transform: scaleY(0.012) scaleX(0.35); filter: brightness(2.5); }\n    88%  { transform: scaleY(0.012) scaleX(0.04); filter: brightness(5); }\n    100% { transform: scaleY(0.012) scaleX(0);    filter: brightness(0); }\n}\n\n.swipe-right-overlay {\n    position: fixed;\n    inset: 0;\n    display: flex;\n    align-items: stretch;\n    z-index: 500;\n    pointer-events: none;\n    opacity: 0;\n    background: rgba(0, 4, 1, 0.88);\n}\n\n.swipe-right-overlay.open {\n    animation: morphIn 0.32s cubic-bezier(0.34, 1.1, 0.64, 1) forwards;\n    pointer-events: auto;\n}\n\n.swipe-right-overlay.crt-closing {\n    animation: crtCollapse 380ms cubic-bezier(0.4, 0, 1, 1) forwards;\n    pointer-events: none;\n}\n";
  document.head.appendChild(__el6);

  // ../node_modules/@capacitor/haptics/dist/esm/index.js
  init_dist();
  init_definitions();
  var Haptics = registerPlugin("Haptics", {
    web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.HapticsWeb())
  });

  // ../src/game/haptics.ts
  var _IS_APP4 = false;
  var hapticImpact = (style = ImpactStyle.Medium) => {
    if (!_IS_APP4) return;
    Haptics.impact({ style }).catch(() => {
    });
  };

  // ../src/game/ui/swipe-carousel/swipe-carousel.ts
  var CARD_WIDTH = 280;
  var CARD_GAP = 16;
  var DRAG_THRESHOLD = 20;
  var AXIS_LOCK_THRESHOLD = 10;
  var createSwipeCarousel = (opts) => {
    const { items, renderCard, renderDetail, isLocked, onTap, onDetailClose } = opts;
    const root = document.createElement("div");
    root.className = "swipe-carousel";
    const track = document.createElement("div");
    track.className = "swipe-track";
    const overlay = document.createElement("div");
    overlay.className = "swipe-right-overlay";
    const state = {
      index: 0,
      openIndex: null,
      pointerStartX: 0,
      pointerStartY: 0,
      pointerCurrentX: 0,
      isDragging: false,
      hasMoved: false
    };
    const cardEls = items.map((item, i) => {
      const locked = isLocked?.(item) ?? false;
      const card = renderCard(item, locked);
      card.classList.add("swipe-card");
      if (locked) card.classList.add("locked");
      card.dataset.index = String(i);
      track.appendChild(card);
      return card;
    });
    const _cardStep = () => CARD_WIDTH + CARD_GAP;
    const _clampIndex = (i) => Math.max(0, Math.min(items.length - 1, i));
    const _totalTrackWidth = () => items.length * CARD_WIDTH + Math.max(0, items.length - 1) * CARD_GAP;
    const _applyTransform = (extraDx = 0) => {
      const visibleWidth = root.offsetWidth;
      if (!visibleWidth) return;
      const totalW = _totalTrackWidth();
      let x;
      if (totalW <= visibleWidth) {
        x = Math.round((visibleWidth - totalW) / 2);
      } else {
        const idealX = -(state.index * _cardStep()) + extraDx;
        x = Math.max(visibleWidth - totalW, Math.min(0, idealX));
      }
      track.style.transform = `translateX(${x}px)`;
    };
    const _closeDetail = () => {
      if (state.openIndex === null) return;
      overlay.style.transformOrigin = "center";
      overlay.classList.add("crt-closing");
      cardEls.forEach((c) => c.classList.remove("active"));
      onDetailClose?.();
      setTimeout(() => {
        state.openIndex = null;
        overlay.classList.remove("open", "crt-closing");
        overlay.innerHTML = "";
      }, 385);
    };
    const _openDetail = (i) => {
      if (!renderDetail || overlay.classList.contains("crt-closing")) return;
      const content = renderDetail(items[i], _closeDetail);
      if (!content) return;
      const rect = cardEls[i].getBoundingClientRect();
      overlay.style.transformOrigin = `${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px`;
      state.openIndex = i;
      overlay.innerHTML = "";
      overlay.appendChild(content);
      overlay.classList.remove("open");
      requestAnimationFrame(() => overlay.classList.add("open"));
      cardEls.forEach((c, ci) => c.classList.toggle("active", ci === i));
    };
    overlay.addEventListener("click", _closeDetail);
    const _goTo = (i) => {
      const next = _clampIndex(i);
      if (next !== state.index) hapticImpact(ImpactStyle.Light);
      state.index = next;
      _applyTransform();
    };
    const _onCardTap = (i) => {
      const locked = isLocked?.(items[i]) ?? false;
      if (locked) return;
      if (renderDetail) {
        _openDetail(i);
      } else {
        if (state.index !== i) _goTo(i);
        onTap?.(items[i]);
      }
    };
    const _onPointerDown = (e) => {
      if (e.target.closest("button, .swipe-nav-btn")) return;
      if (state.openIndex !== null) return;
      state.pointerStartX = e.clientX;
      state.pointerStartY = e.clientY;
      state.pointerCurrentX = e.clientX;
      state.isDragging = true;
      state.hasMoved = false;
      track.classList.add("dragging");
      root.setPointerCapture(e.pointerId);
    };
    const _onPointerMove = (e) => {
      if (!state.isDragging) return;
      const dx = e.clientX - state.pointerStartX;
      const dy = e.clientY - state.pointerStartY;
      if (!state.hasMoved && Math.abs(dy) > AXIS_LOCK_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
        state.isDragging = false;
        track.classList.remove("dragging");
        return;
      }
      if (Math.abs(dx) > AXIS_LOCK_THRESHOLD) state.hasMoved = true;
      state.pointerCurrentX = e.clientX;
      _applyTransform(dx);
    };
    const _onPointerUp = (e) => {
      if (!state.isDragging) return;
      state.isDragging = false;
      track.classList.remove("dragging");
      const dx = e.clientX - state.pointerStartX;
      if (Math.abs(dx) >= DRAG_THRESHOLD) {
        const direction = dx < 0 ? 1 : -1;
        _goTo(state.index + direction);
        _closeDetail();
      } else if (!state.hasMoved) {
        const el2 = document.elementFromPoint(e.clientX, e.clientY);
        const cardEl = el2?.closest("[data-index]");
        if (cardEl && cardEl.dataset.index !== void 0) {
          _onCardTap(Number(cardEl.dataset.index));
        }
      } else {
        _applyTransform();
      }
    };
    root.addEventListener("pointerdown", _onPointerDown);
    root.addEventListener("pointermove", _onPointerMove);
    root.addEventListener("pointerup", _onPointerUp);
    root.addEventListener("pointercancel", () => {
      state.isDragging = false;
      track.classList.remove("dragging");
      _applyTransform();
    });
    root.addEventListener("contextmenu", (e) => e.preventDefault());
    root.appendChild(track);
    root.appendChild(overlay);
    requestAnimationFrame(() => {
      track.classList.add("dragging");
      _applyTransform();
      requestAnimationFrame(() => track.classList.remove("dragging"));
    });
    return root;
  };

  // ../src/game/ui/campaign-select/campaign-select.ui.ts
  var _IS_APP5 = false;
  var mount3 = () => {
    ensureEl("campaign-select");
  };
  var show2 = (deps) => {
    const { session: session2, campaigns, onSelect, onBack } = deps;
    const body = mountScreenShell("campaign-select", I18N.CAMPAIGN_SELECT_TITLE, I18N.CAMPAIGN_SELECT_SUB, onBack);
    const typePriority = (t) => t === "tutorial" ? 0 : t === "free-flight" ? 1 : 2;
    const displayOrder = campaigns.map((c, i) => ({ ...c, index: i })).filter((c) => !_IS_APP5 ? c.type !== "multiplayer" : true).sort((a, b) => typePriority(a.type) - typePriority(b.type));
    const carousel = createSwipeCarousel({
      items: displayOrder,
      isLocked: (c) => !isCampaignUnlocked(session2, campaigns, c.index),
      renderCard: (c, locked) => {
        const isTutorial = c.type === "tutorial";
        const isActive = !isTutorial && c.type !== "free-flight" && session2.activeCampaignIndex === c.index;
        const cp = session2.campaignProgress[String(c.index)];
        const completedCount = cp?.missions.filter((m) => m?.completed).length ?? 0;
        const card = document.createElement("div");
        let content = `<div class="box-label"${isTutorial ? ` style="color:#ff9900"` : ""}>${localize(c.campaignTitle)}</div>`;
        if (locked) {
          content += `<div class="box-sub" style="color:#333">${I18N.CAMPAIGN_LOCKED}</div>`;
        } else {
          content += c.campaignSublines.map((s) => `<div class="box-sub">${localize(s)}</div>`).join("");
          content += `<div class="box-sub">${I18N.CAMPAIGN_SELECT_MISSIONS}: ${c.levels.length}</div>`;
          if (isActive && completedCount > 0) {
            content += `<div class="box-sub" style="color:#8af">${completedCount}/${c.levels.length} ${I18N.DONE}</div>`;
          }
        }
        card.innerHTML = content;
        if (isTutorial) card.style.borderColor = "#ff9900";
        return card;
      },
      onTap: (c) => onSelect(c.index)
    });
    body.appendChild(carousel);
    showScreenCrtEnter("campaign-select");
  };

  // ../src/game/ui/mission-select/mission-select.css
  var __el7 = document.createElement("style");
  __el7.textContent = "#mission-grid {\n    display: flex;\n    flex-wrap: wrap;\n    justify-content: center;\n    gap: 20px;\n    max-width: 1100px;\n    padding: 0 20px;\n    height: auto;\n}\n\n#mission-grid .grid-box {\n    flex: 0 0 300px;\n    min-height: 120px;\n    height: auto;\n}\n\n.mission-done {\n    color: #5f5;\n}\n\n.mission-time {\n    color: #8af;\n    font-family: monospace;\n}\n";
  document.head.appendChild(__el7);

  // ../src/game/ui/mission-select/mission-select.ui.ts
  var mount4 = () => {
    ensureEl("mission-select");
  };
  var show3 = (deps) => {
    const { campaign, campaignIndex, session: session2, onSelect, onBack } = deps;
    const key = String(campaignIndex);
    const cp = session2.campaignProgress[key];
    const body = mountScreenShell("mission-select", localize(campaign.campaignTitle), I18N.MISSION_SELECT_SUB, onBack);
    const missionItems = campaign.levels.map((level, i) => {
      const mp = cp?.missions[i];
      return {
        level,
        index: i,
        unlocked: isMissionUnlocked(session2, key, i, campaign.type),
        done: mp?.completed ?? false,
        bestTime: mp?.bestTimeMs ?? null
      };
    });
    const carousel = createSwipeCarousel({
      items: missionItems,
      isLocked: (m) => !m.unlocked,
      renderCard: (m) => {
        const card = document.createElement("div");
        let content = `<div class="box-label${m.done ? " mission-done" : ""}">${localize(m.level.headline)}</div>`;
        if (!m.unlocked) {
          content += `<div class="box-sub" style="color:#333">${I18N.MISSION_LOCKED}</div>`;
        } else {
          content += (m.level.sublines ?? []).map((s) => `<div class="box-sub">${localize(s)}</div>`).join("");
          if (m.done && m.bestTime !== null) {
            content += `<div class="box-sub mission-time">${I18N.BEST_TIME(m.bestTime)}</div>`;
          } else if (m.done) {
            content += `<div class="box-sub mission-done">\u2713 ${I18N.DONE}</div>`;
          }
        }
        card.innerHTML = content;
        return card;
      },
      onTap: (m) => onSelect(m.index)
    });
    body.appendChild(carousel);
    showScreenCrtEnter("mission-select");
  };

  // ../src/game/ui/heli-select/heli-select.css
  var __el8 = document.createElement("style");
  __el8.textContent = ".heli-card-canvas {\n    position: absolute;\n    inset: 0;\n    width: 100%;\n    height: 100%;\n    pointer-events: none;\n    display: block;\n}\n\n.heli-card-label {\n    position: absolute;\n    bottom: 0;\n    left: 0;\n    right: 0;\n    padding: 20px 10px 8px;\n    background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));\n    text-align: center;\n    pointer-events: none;\n}\n\n.heli-lock-label {\n    color: #333;\n    text-shadow: none;\n}\n\n.heli-cap-label {\n    color: #aaa;\n    text-shadow: 0 0 6px #000, 0 0 3px #000;\n}\n\n.heli-card-label .box-label {\n    text-shadow: 0 0 8px #000, 0 0 4px #000;\n}\n\n/* \u2500\u2500\u2500 overlay: 3-column layout \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.heli-overlay-wrap {\n    display: flex;\n    flex-direction: row;\n    align-items: stretch;\n    width: 100%;\n    flex: 1;\n    min-width: 0;\n}\n\n/* Column 1: animated heli canvas \u2014 overflows into text column, sits below text */\n.heli-overlay-canvas-wrap {\n    flex: 1;\n    min-width: 0;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    cursor: pointer;\n    overflow: visible;\n    position: relative;\n    z-index: 0;\n}\n\n.heli-overlay-canvas {\n    width: 140%;\n    max-width: 360px;\n    aspect-ratio: 360 / 280;\n    display: block;\n    pointer-events: none;\n}\n\n/* Column 2: description text \u2014 sits above overflowing canvas */\n.heli-overlay-text {\n    flex: 1;\n    min-width: 0;\n    display: flex;\n    align-items: center;\n    padding: 20px 24px;\n    font-size: 13px;\n    color: #777;\n    line-height: 1.8;\n    cursor: pointer;\n    border-left: 1px solid #1a1a1a;\n    position: relative;\n    z-index: 1;\n}\n\n/* Column 3: stat bars + button */\n.heli-overlay-stats {\n    flex: 1;\n    min-width: 0;\n    background: rgba(0, 20, 8, 0.97);\n    border-left: 1px solid #ff6600;\n    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.6);\n    overflow-y: auto;\n    display: flex;\n    flex-direction: column;\n    justify-content: center;\n    padding: 16px 14px;\n    box-sizing: border-box;\n    position: relative;\n    z-index: 1;\n}\n\n.heli-stat-row {\n    display: flex;\n    align-items: center;\n    width: 100%;\n    margin: 4px 0;\n    font-size: 11px;\n    gap: 8px;\n}\n\n.heli-stat-label {\n    letter-spacing: 1px;\n    color: #888;\n    width: 72px;\n    flex-shrink: 0;\n    text-align: left;\n}\n\n.heli-stat-bar {\n    flex: 1;\n    height: 4px;\n    background: #0e0e0e;\n    border: 1px solid #1e1e1e;\n    border-radius: 3px;\n    overflow: hidden;\n}\n\n.heli-stat-fill {\n    height: 100%;\n    background: linear-gradient(to right, #ff6600, #ffcc00);\n    border-radius: 3px;\n    transition: width 0.7s ease;\n    width: 0%;\n}\n\n.heli-select-btn {\n    margin-top: 14px;\n    padding: 9px 0;\n    width: 100%;\n    background: transparent;\n    border: 1px solid #ff6600;\n    color: #ff6600;\n    font-family: inherit;\n    font-size: 13px;\n    letter-spacing: 3px;\n    cursor: pointer;\n    border-radius: 3px;\n    text-transform: uppercase;\n    transition: background 0.2s, color 0.2s, box-shadow 0.2s;\n}\n\n.heli-select-btn:hover {\n    background: #ff6600;\n    color: #000;\n    box-shadow: 0 0 20px rgba(255, 102, 0, 0.5);\n}\n";
  document.head.appendChild(__el8);

  // ../src/game/render.ts
  var iso = (vx, vy, h, cx, cy, { canvas, tileW: tileW2, tileH: tileH2, stepH: stepH2 }) => {
    let cv = canvas || document.getElementById("gameCanvas");
    return {
      x: cv.width / 2 + (vx - vy) * (tileW2 / 2) - cx,
      y: cv.height / 2 + (vx + vy) * (tileH2 / 2) - h * stepH2 - cy
    };
  };

  // ../src/game/models/coasthawk.zdef
  var coasthawk_default = {
    id: "coasthawk",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "body",
        xMin: -3,
        xMax: 1.3,
        yMin: -0.5,
        yMax: 0.5,
        zMin: 0,
        zMax: 1.3
      }
    ],
    faces: [
      {
        id: "tail_rotor_bar",
        verts: [
          [
            -2.4,
            0.6,
            0.25
          ],
          [
            -2.4,
            -0.6,
            0.25
          ],
          [
            -2.4,
            -0.6,
            0.35
          ],
          [
            -2.4,
            0.6,
            0.35
          ]
        ],
        color: "#222222"
      },
      {
        id: "tail_fin",
        verts: [
          [
            -2.4,
            0,
            0.6
          ],
          [
            -2.9,
            0,
            1.3
          ],
          [
            -3,
            0,
            0.6
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "tail_boom",
        verts: [
          [
            -1.1,
            0.08,
            0.6
          ],
          [
            -2.4,
            0.08,
            0.6
          ],
          [
            -2.4,
            -0.08,
            0.6
          ],
          [
            -1.1,
            -0.08,
            0.6
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "fuselage",
        verts: [
          [
            1.3,
            0,
            0.3
          ],
          [
            0.4,
            -0.45,
            0.4
          ],
          [
            -1,
            -0.45,
            0.4
          ],
          [
            -1.1,
            0,
            0.6
          ],
          [
            -1,
            0.45,
            0.4
          ],
          [
            0.4,
            0.45,
            0.4
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "window_right",
        verts: [
          [
            0.3,
            -0.47,
            0.35
          ],
          [
            -0.6,
            -0.47,
            0.35
          ],
          [
            -0.6,
            -0.3,
            0.6
          ],
          [
            0.3,
            -0.3,
            0.6
          ]
        ],
        color: "#111111"
      },
      {
        id: "window_left",
        verts: [
          [
            0.3,
            0.47,
            0.35
          ],
          [
            -0.6,
            0.47,
            0.35
          ],
          [
            -0.6,
            0.3,
            0.6
          ],
          [
            0.3,
            0.3,
            0.6
          ]
        ],
        color: "#111111"
      },
      {
        id: "cockpit_nose",
        verts: [
          [
            1.3,
            0,
            0.3
          ],
          [
            0.6,
            0.4,
            0.6
          ],
          [
            0.6,
            -0.4,
            0.6
          ]
        ],
        color: "#111111"
      }
    ]
  };

  // ../src/game/models/dolphin.zdef
  var dolphin_default = {
    id: "dolphin",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "body",
        xMin: -1.4,
        xMax: 0.98,
        yMin: -0.28,
        yMax: 0.28,
        zMin: 0,
        zMax: 0.84
      }
    ],
    faces: [
      {
        id: "fuselage",
        verts: [
          [
            0.98,
            0,
            0.14
          ],
          [
            0,
            -0.28,
            0.28
          ],
          [
            -0.56,
            0,
            0.35
          ],
          [
            0,
            0.28,
            0.28
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "cockpit",
        verts: [
          [
            0.84,
            0,
            0.175
          ],
          [
            0.21,
            -0.21,
            0.42
          ],
          [
            0.21,
            0.21,
            0.42
          ]
        ],
        color: "#112233"
      },
      {
        id: "tail_fin",
        verts: [
          [
            -0.56,
            0,
            0.35
          ],
          [
            -1.26,
            0,
            0.84
          ],
          [
            -1.4,
            0,
            0.28
          ]
        ],
        color: "#ff6600"
      }
    ]
  };

  // ../src/game/models/atlas.zdef
  var atlas_default = {
    id: "atlas",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "body",
        xMin: -2.6,
        xMax: 2.8,
        yMin: -0.6,
        yMax: 0.6,
        zMin: 0,
        zMax: 1.8
      }
    ],
    faces: [
      {
        id: "bottom",
        verts: [
          [
            1.8,
            0.3,
            0.15
          ],
          [
            1.8,
            -0.3,
            0.15
          ],
          [
            -2,
            -0.3,
            0.15
          ],
          [
            -2,
            0.3,
            0.15
          ]
        ],
        color: "#dd5500"
      },
      {
        id: "side_left_lower",
        verts: [
          [
            1.8,
            0.3,
            0.15
          ],
          [
            1.8,
            0.6,
            0.5
          ],
          [
            -2,
            0.6,
            0.5
          ],
          [
            -2,
            0.3,
            0.15
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "side_left_upper",
        verts: [
          [
            1.8,
            0.6,
            0.5
          ],
          [
            1.8,
            0.3,
            0.85
          ],
          [
            -2,
            0.3,
            0.85
          ],
          [
            -2,
            0.6,
            0.5
          ]
        ],
        color: "#ff7711"
      },
      {
        id: "side_right_lower",
        verts: [
          [
            1.8,
            -0.3,
            0.15
          ],
          [
            1.8,
            -0.6,
            0.5
          ],
          [
            -2,
            -0.6,
            0.5
          ],
          [
            -2,
            -0.3,
            0.15
          ]
        ],
        color: "#cc4400"
      },
      {
        id: "side_right_upper",
        verts: [
          [
            1.8,
            -0.6,
            0.5
          ],
          [
            1.8,
            -0.3,
            0.85
          ],
          [
            -2,
            -0.3,
            0.85
          ],
          [
            -2,
            -0.6,
            0.5
          ]
        ],
        color: "#dd5500"
      },
      {
        id: "top",
        verts: [
          [
            1.8,
            0.3,
            0.85
          ],
          [
            1.8,
            -0.3,
            0.85
          ],
          [
            -2,
            -0.3,
            0.85
          ],
          [
            -2,
            0.3,
            0.85
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "tail_roof",
        verts: [
          [
            -2,
            0.3,
            0.85
          ],
          [
            -2,
            -0.3,
            0.85
          ],
          [
            -2.6,
            0,
            1.1
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "tail_left",
        verts: [
          [
            -2,
            0.6,
            0.5
          ],
          [
            -2,
            0.3,
            0.85
          ],
          [
            -2.6,
            0,
            1.1
          ],
          [
            -2.6,
            0,
            0.4
          ]
        ],
        color: "#ff7711"
      },
      {
        id: "tail_right",
        verts: [
          [
            -2,
            -0.6,
            0.5
          ],
          [
            -2,
            -0.3,
            0.85
          ],
          [
            -2.6,
            0,
            1.1
          ],
          [
            -2.6,
            0,
            0.4
          ]
        ],
        color: "#dd5500"
      },
      {
        id: "nose",
        verts: [
          [
            2.8,
            0,
            0.45
          ],
          [
            1.8,
            -0.6,
            0.5
          ],
          [
            1.8,
            -0.3,
            0.85
          ],
          [
            1.8,
            0.3,
            0.85
          ],
          [
            1.8,
            0.6,
            0.5
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "cockpit_front",
        verts: [
          [
            2.6,
            0,
            0.5
          ],
          [
            2.2,
            -0.35,
            0.6
          ],
          [
            2.2,
            0.35,
            0.6
          ]
        ],
        color: "#111111"
      },
      {
        id: "window_left",
        verts: [
          [
            1.5,
            0.31,
            0.6
          ],
          [
            1,
            0.31,
            0.6
          ],
          [
            1,
            0.31,
            0.75
          ],
          [
            1.5,
            0.31,
            0.75
          ]
        ],
        color: "#111111"
      },
      {
        id: "window_right",
        verts: [
          [
            1.5,
            -0.31,
            0.6
          ],
          [
            1,
            -0.31,
            0.6
          ],
          [
            1,
            -0.31,
            0.75
          ],
          [
            1.5,
            -0.31,
            0.75
          ]
        ],
        color: "#111111"
      },
      {
        id: "fpylon_front",
        verts: [
          [
            1.8,
            0.3,
            0.85
          ],
          [
            1.8,
            -0.3,
            0.85
          ],
          [
            1.5,
            0,
            1.15
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "fpylon_right",
        verts: [
          [
            1.8,
            -0.3,
            0.85
          ],
          [
            1.2,
            -0.3,
            0.85
          ],
          [
            1.5,
            0,
            1.15
          ]
        ],
        color: "#dd5500"
      },
      {
        id: "fpylon_back",
        verts: [
          [
            1.2,
            -0.3,
            0.85
          ],
          [
            1.2,
            0.3,
            0.85
          ],
          [
            1.5,
            0,
            1.15
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "fpylon_left",
        verts: [
          [
            1.2,
            0.3,
            0.85
          ],
          [
            1.8,
            0.3,
            0.85
          ],
          [
            1.5,
            0,
            1.15
          ]
        ],
        color: "#ff7711"
      },
      {
        id: "rpylon_front",
        verts: [
          [
            -1.9,
            0.3,
            1
          ],
          [
            -1.9,
            -0.3,
            1
          ],
          [
            -2.3,
            0,
            1.8
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "rpylon_right",
        verts: [
          [
            -1.9,
            -0.3,
            1
          ],
          [
            -2.5,
            -0.15,
            1.1
          ],
          [
            -2.3,
            0,
            1.8
          ]
        ],
        color: "#dd5500"
      },
      {
        id: "rpylon_back",
        verts: [
          [
            -2.5,
            -0.15,
            1.1
          ],
          [
            -2.5,
            0.15,
            1.1
          ],
          [
            -2.3,
            0,
            1.8
          ]
        ],
        color: "#cc4400"
      },
      {
        id: "rpylon_left",
        verts: [
          [
            -2.5,
            0.15,
            1.1
          ],
          [
            -1.9,
            0.3,
            1
          ],
          [
            -2.3,
            0,
            1.8
          ]
        ],
        color: "#ff7711"
      }
    ]
  };

  // ../src/game/models/ornithopter.zdef
  var ornithopter_default = {
    id: "ornithopter_westwood_final_flat",
    label: "ornithopter_westwood_final_flat",
    static: false,
    movementType: "none",
    pivot: [
      0,
      0,
      0
    ],
    faces: [],
    collisionBoxes: [
      {
        id: "hull_core",
        xMin: -0.8,
        xMax: 0.9,
        yMin: -0.35,
        yMax: 0.35,
        zMin: 0.1,
        zMax: 0.55
      },
      {
        id: "tail_boom",
        xMin: -1.6,
        xMax: -0.8,
        yMin: -0.15,
        yMax: 0.15,
        zMin: 0.2,
        zMax: 0.5
      }
    ],
    parts: [
      {
        id: "body",
        faces: [
          {
            id: "belly",
            verts: [
              [
                0.9,
                0,
                0.1
              ],
              [
                0.4,
                0.35,
                0.1
              ],
              [
                -0.8,
                0.3,
                0.1
              ],
              [
                -0.8,
                -0.3,
                0.1
              ],
              [
                0.4,
                -0.35,
                0.1
              ]
            ],
            color: "#bcbcbc"
          },
          {
            id: "side_l",
            verts: [
              [
                0.9,
                0.15,
                0.1
              ],
              [
                0.5,
                0.2,
                0.45
              ],
              [
                -0.8,
                0.22,
                0.45
              ],
              [
                -0.8,
                0.3,
                0.1
              ],
              [
                0.4,
                0.35,
                0.1
              ]
            ],
            color: "#dcdcdc"
          },
          {
            id: "side_r",
            verts: [
              [
                0.9,
                -0.15,
                0.1
              ],
              [
                0.4,
                -0.35,
                0.1
              ],
              [
                -0.8,
                -0.3,
                0.1
              ],
              [
                -0.8,
                -0.22,
                0.45
              ],
              [
                0.5,
                -0.2,
                0.45
              ]
            ],
            color: "#dcdcdc"
          },
          {
            id: "top",
            verts: [
              [
                0.1,
                0.25,
                0.5
              ],
              [
                0.1,
                -0.25,
                0.5
              ],
              [
                -0.8,
                -0.22,
                0.45
              ],
              [
                -0.8,
                0.22,
                0.45
              ]
            ],
            color: "#f2f2f2"
          },
          {
            id: "tail",
            verts: [
              [
                -0.8,
                0.15,
                0.45
              ],
              [
                -0.8,
                -0.15,
                0.45
              ],
              [
                -1.6,
                0,
                0.5
              ],
              [
                -1.6,
                0,
                0.2
              ],
              [
                -0.8,
                0,
                0.1
              ]
            ],
            color: "#f2f2f2"
          },
          {
            id: "cockpit_f",
            verts: [
              [
                0.91,
                0.15,
                0.1
              ],
              [
                0.91,
                -0.15,
                0.1
              ],
              [
                0.5,
                -0.2,
                0.45
              ],
              [
                0.5,
                0.2,
                0.45
              ]
            ],
            color: "#add8e6"
          },
          {
            id: "cockpit_t",
            verts: [
              [
                0.5,
                0.2,
                0.45
              ],
              [
                0.5,
                -0.2,
                0.45
              ],
              [
                0.1,
                -0.25,
                0.5
              ],
              [
                0.1,
                0.25,
                0.5
              ]
            ],
            color: "#add8e6"
          }
        ]
      },
      {
        id: "wing_L_inner",
        rotate: {
          pivot: [
            -0.2,
            0.25,
            0.48
          ],
          axis: [
            1,
            0,
            0
          ],
          param: "wingAngle"
        },
        faces: [
          {
            id: "wl_in",
            verts: [
              [
                0.2,
                0.25,
                0.48
              ],
              [
                0.1,
                2.5,
                1.4
              ],
              [
                -0.6,
                2.5,
                1.4
              ],
              [
                -0.7,
                0.22,
                0.48
              ]
            ],
            color: "#ffffff"
          }
        ]
      },
      {
        id: "wing_L_outer",
        parent: "wing_L_inner",
        rotate: {
          pivot: [
            -0.25,
            2.5,
            1.4
          ],
          axis: [
            1,
            0,
            0
          ],
          param: "wingTipAngle"
        },
        faces: [
          {
            id: "wl_out",
            verts: [
              [
                0.1,
                2.5,
                1.4
              ],
              [
                0,
                3.8,
                0.4
              ],
              [
                -0.2,
                3.8,
                0.4
              ],
              [
                -0.6,
                2.5,
                1.4
              ]
            ],
            color: "#eeeeee"
          }
        ]
      },
      {
        id: "wing_R_inner",
        rotate: {
          pivot: [
            -0.2,
            -0.25,
            0.48
          ],
          axis: [
            1,
            0,
            0
          ],
          param: "wingAngleInv"
        },
        faces: [
          {
            id: "wr_in",
            verts: [
              [
                0.2,
                -0.25,
                0.48
              ],
              [
                -0.7,
                -0.22,
                0.48
              ],
              [
                -0.6,
                -2.5,
                1.4
              ],
              [
                0.1,
                -2.5,
                1.4
              ]
            ],
            color: "#ffffff"
          }
        ]
      },
      {
        id: "wing_R_outer",
        parent: "wing_R_inner",
        rotate: {
          pivot: [
            -0.25,
            -2.5,
            1.4
          ],
          axis: [
            1,
            0,
            0
          ],
          param: "wingTipAngleInv"
        },
        faces: [
          {
            id: "wr_out",
            verts: [
              [
                0.1,
                -2.5,
                1.4
              ],
              [
                -0.6,
                -2.5,
                1.4
              ],
              [
                -0.2,
                -3.8,
                0.4
              ],
              [
                0,
                -3.8,
                0.4
              ]
            ],
            color: "#eeeeee"
          }
        ]
      }
    ]
  };

  // ../src/game/heli-types.ts
  var HELI_TYPES = [
    {
      id: "dolphin",
      label: "Dolphin",
      def: dolphin_default,
      maxLoad: 3,
      accel: 117e-5,
      friction: 0.995,
      tiltSpeed: 0.05,
      fuelRate: 0.012,
      liftPower: 9e-4,
      cargoResist: 0.5,
      scale: 0.7,
      previewScale: 1.43,
      collisionBox: { xMin: -1.26, xMax: 1.26, yMin: -0.28, yMax: 0.28, zMax: 0.56 },
      rotorOffsets: [0],
      extraRotorDebris: false,
      canCarryCargo: false,
      selectLabel: "DOLPHIN",
      selectSub: "Wendig / Schnell",
      selectCap: "Kap.: 3 (Leichtgewicht)",
      description: "Ein wendiger K\xFCstenwachthubschrauber \u2014 ideal f\xFCr schnelle Eins\xE4tze in schwierigem Gel\xE4nde. Leicht, pr\xE4zise, reaktionsschnell. Das bevorzugte Werkzeug erfahrener Piloten.",
      minRankIndex: 1
    },
    {
      id: "coasthawk",
      label: "Coast-Hawk",
      def: coasthawk_default,
      maxLoad: 10,
      accel: 502e-6,
      friction: 0.998,
      tiltSpeed: 0.015,
      fuelRate: 7e-3,
      liftPower: 5e-4,
      cargoResist: 0.1,
      scale: 1,
      previewScale: 1,
      collisionBox: { xMin: -3, xMax: 1.3, yMin: -0.5, yMax: 0.5, zMax: 1.3 },
      rotorOffsets: [0],
      extraRotorDebris: false,
      canCarryCargo: true,
      selectLabel: "Coast-Hawk",
      selectSub: "Schwer / Stabil",
      selectCap: "Kap.: 10 (Schwerlast)",
      description: "Das Arbeitstier der Seenotrettung. Tr\xE4gt schwere Lasten \xFCber weite Strecken, auch bei rauem Wetter. Einmal in Fahrt gebracht, ist er schwer aufzuhalten.",
      minRankIndex: 0
    },
    {
      id: "atlas",
      label: "Atlas",
      def: atlas_default,
      maxLoad: 20,
      accel: 212e-6,
      friction: 0.9992,
      tiltSpeed: 0.01,
      fuelRate: 5e-3,
      liftPower: 4e-4,
      cargoResist: 0.05,
      scale: 1,
      previewScale: 1,
      collisionBox: { xMin: -2.6, xMax: 2.8, yMin: -0.6, yMax: 0.6, zMax: 1.8 },
      rotorOffsets: [1.5, -2.3],
      extraRotorDebris: true,
      canCarryCargo: true,
      selectLabel: "Atlas",
      selectSub: "Tandem / Extraschwer",
      selectCap: "Kap.: 20 (Schwerlast)",
      description: "Zwei Rotoren, keine Ausrede. Der Atlas ist f\xFCr den Masseneinsatz gebaut \u2014 wenn normale Helikopter kapitulieren, fliegt der Atlas.",
      minRankIndex: 2
    },
    {
      id: "ornithopter",
      label: "Ornithopter",
      def: ornithopter_default,
      maxLoad: 2,
      accel: 145e-5,
      friction: 0.993,
      tiltSpeed: 0.045,
      fuelRate: 9e-3,
      liftPower: 82e-5,
      cargoResist: 0.25,
      scale: 0.7,
      previewScale: 1.43,
      collisionBox: { xMin: -1.6, xMax: 0.9, yMin: -0.35, yMax: 0.35, zMax: 0.55 },
      rotorOffsets: [0],
      extraRotorDebris: false,
      canCarryCargo: true,
      selectLabel: "ORNITHOPTER",
      selectSub: "Schl\xE4ger / Wendig",
      selectCap: "Kap.: 2 (Schnelleinsatz)",
      description: "Ein Fl\xFCgelschl\xE4ger der n\xE4chsten Generation. Zwei Mann, maximale Wendigkeit. Mit Fracht \xFCberraschend schnell \u2014 kein Helikopter, kein Flugzeug, etwas dazwischen.",
      minRankIndex: 3,
      hideWhenLocked: true
    }
  ];
  function getHeliType(id) {
    const ht = HELI_TYPES.find((h) => h.id === id);
    if (!ht) throw new Error(`Unknown heli type: ${id}`);
    return ht;
  }

  // ../src/game/render-config.ts
  var _isApp = false;
  var _isIPad = _isApp && (navigator.userAgent.includes("iPad") || navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  var CANVAS_SCALE = _isApp ? 0.5 : 1;
  var tileW = _isIPad ? 28 : _isApp ? 20 : 64;
  var tileH = _isIPad ? 14 : _isApp ? 10 : 32;
  var stepH = _isIPad ? 10.9 : _isApp ? 7.8 : 25;

  // ../src/game/state.ts
  var createZstate = () => {
    const state = {
      gameStarted: false,
      crashed: false,
      missionType: "",
      goalCount: 0,
      totalRescued: 0,
      totalSpawned: 0,
      cam: { x: 0, y: 0 }
    };
    return state;
  };
  var zstate = createZstate();
  var G = {
    goalCount: 0,
    totalRescued: 0,
    waterLevel: 0,
    objectives: [],
    menuHover: Object.fromEntries(HELI_TYPES.map((h) => [h.id, false])),
    menuAngles: Object.fromEntries(HELI_TYPES.map((h) => [h.id, -0.5])),
    points: [],
    particles: [],
    debris: [],
    CARRIER: {},
    BOATS: [],
    SUBMARINES: [],
    RESEARCH_PLATFORMS: [],
    WIND_TURBINES: [],
    PLANE_WRECKS: [],
    BROKEN_SAILBOATS: [],
    seaTime: 0,
    payloads: [],
    activePayload: null,
    rescuerSwing: { x: 0, y: 0, vx: 0, vy: 0 },
    npcHelis: [],
    deliverMode: false,
    heli: {
      type: "dolphin",
      x: 0,
      y: 0,
      z: 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
      angle: 0,
      tilt: 0,
      roll: 0,
      winch: 0,
      fuel: 100,
      engineOn: false,
      rotorRPM: 0,
      rotationPos: 0,
      onboard: 0,
      maxLoad: 5,
      accel: 25e-4,
      friction: 0.99,
      tiltSpeed: 0.02,
      fuelRate: 0.012,
      liftPower: 3e-3,
      inAir: false,
      cargoResist: 1
    },
    wind: { x: 0, y: 0, phase: 0, angle: Math.random() * Math.PI * 2, varOffset: 0 },
    keys: {},
    flocks: [],
    TREES_MAP: null,
    PAD: null,
    START_POS: null,
    fuelTruck: {
      state: "PARKED",
      x: 0,
      y: 0,
      angle: 0,
      arm: 0,
      localParkX: 0,
      localParkY: 0,
      localParkAngle: 0,
      t: 0,
      wps: null
    },
    carrierFuelCar: {
      state: "PARKED",
      x: 0,
      y: 0,
      angle: Math.PI / 2 + 0.25 + Math.PI,
      // fixed local position on carrier deck (white tractor slot)
      localParkX: 2.8,
      localParkY: 2.7,
      // car.angle = front/drive direction (like ft.angle); body = car.angle + PI
      localParkAngle: Math.PI / 2 + 0.25 + Math.PI,
      t: 0,
      wps: null
    },
    /** Remote player's heli – set when multiplayer is active, null otherwise */
    remoteHeli: null
  };

  // ../src/game/ui/heli-select/heli-select.ui.ts
  var _G;
  var _drawHeli;
  var _previewAnimRunning = false;
  var _activeHeliId = null;
  var _rotorPos = 0;
  var _overlayAngle = 0;
  var OVERLAY_SCALE_RATIO = 2.2;
  var _heliPreviewLoop = () => {
    if (document.getElementById("heli-select").style.display === "none") {
      _previewAnimRunning = false;
      return;
    }
    _rotorPos += 0.18;
    HELI_TYPES.forEach((ht) => {
      const isActive = ht.id === _activeHeliId;
      const cardAngle = isActive ? -0.075 : _G.menuAngles[ht.id];
      if (isActive) {
        _overlayAngle += 9e-3;
      } else {
        const diff = -0.075 - _G.menuAngles[ht.id];
        if (Math.abs(diff) > 1e-3) _G.menuAngles[ht.id] += diff * 0.1;
      }
      const c = document.getElementById("icon-" + ht.id);
      if (c) {
        const cx = c.getContext("2d");
        const tW = Math.round(280 * CANVAS_SCALE);
        const tH = Math.round(220 * CANVAS_SCALE);
        if (c.width !== tW || c.height !== tH) {
          c.width = tW;
          c.height = tH;
        } else cx.clearRect(0, 0, c.width, c.height);
        const offIso = (wx, wy, wz, camX, camY) => iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
        _drawHeli(ht.id, 0, 0, 0, cardAngle, 0, 0, 0, 0, 0, {
          targetCtx: cx,
          targetIso: offIso,
          scaleOverride: ht.previewScale
        });
      }
      if (isActive) {
        const oc = document.getElementById("overlay-icon-" + ht.id);
        if (oc && oc.isConnected) {
          const ocx = oc.getContext("2d");
          const oW = Math.round(360 * CANVAS_SCALE);
          const oH = Math.round(280 * CANVAS_SCALE);
          if (oc.width !== oW || oc.height !== oH) {
            oc.width = oW;
            oc.height = oH;
          } else ocx.clearRect(0, 0, oc.width, oc.height);
          const overlayIso = (wx, wy, wz, camX, camY) => iso(wx, wy, wz, camX, camY, { canvas: oc, tileW, tileH, stepH });
          _drawHeli(ht.id, 0, 0, 0, _overlayAngle, 0, 0, _rotorPos, 0, 0, {
            targetCtx: ocx,
            targetIso: overlayIso,
            scaleOverride: ht.previewScale * OVERLAY_SCALE_RATIO
          });
        }
      }
    });
    requestAnimationFrame(_heliPreviewLoop);
  };
  var animateHeliPreviews = () => {
    if (_previewAnimRunning) return;
    _previewAnimRunning = true;
    _rotorPos = 0;
    _activeHeliId = null;
    _heliPreviewLoop();
  };
  var mount5 = () => {
    ensureEl("heli-select");
  };
  var _statBar = (label, pct) => {
    const row = document.createElement("div");
    row.className = "heli-stat-row";
    row.innerHTML = `
        <span class="heli-stat-label">${label}</span>
        <div class="heli-stat-bar"><div class="heli-stat-fill" style="width:0%" data-pct="${pct}"></div></div>`;
    return row;
  };
  var _buildOverlayDetail = (ht, onSelect) => {
    const wrap = document.createElement("div");
    wrap.className = "heli-overlay-wrap";
    const canvasWrap = document.createElement("div");
    canvasWrap.className = "heli-overlay-canvas-wrap";
    const canvas = document.createElement("canvas");
    canvas.className = "heli-overlay-canvas";
    canvas.id = "overlay-icon-" + ht.id;
    canvasWrap.appendChild(canvas);
    wrap.appendChild(canvasWrap);
    if (ht.description) {
      const textCol = document.createElement("div");
      textCol.className = "heli-overlay-text";
      textCol.textContent = ht.description;
      wrap.appendChild(textCol);
    }
    const statsCol = document.createElement("div");
    statsCol.className = "heli-overlay-stats";
    statsCol.addEventListener("click", (e) => e.stopPropagation());
    const spd = Math.min(100, Math.round(ht.accel / 117e-5 * 100));
    const agi = Math.min(100, Math.round(ht.tiltSpeed / 0.05 * 100));
    const cap = Math.min(100, Math.round(ht.maxLoad / 20 * 100));
    const end = Math.min(100, Math.max(0, Math.round((0.012 - ht.fuelRate) / 0.012 * 90 + 10)));
    statsCol.appendChild(_statBar("GESCHW.", spd));
    statsCol.appendChild(_statBar("AGILIT\xC4T", agi));
    statsCol.appendChild(_statBar("KAPAZIT\xC4T", cap));
    statsCol.appendChild(_statBar("AUSDAUER", end));
    const btn = document.createElement("button");
    btn.className = "heli-select-btn";
    btn.textContent = I18N.HELI_SELECT_CONFIRM;
    btn.addEventListener("click", () => {
      _activeHeliId = null;
      onSelect(ht.id);
    });
    statsCol.appendChild(btn);
    requestAnimationFrame(() => {
      statsCol.querySelectorAll(".heli-stat-fill").forEach((el2) => {
        el2.style.width = (el2.dataset.pct ?? "0") + "%";
      });
    });
    wrap.appendChild(statsCol);
    return wrap;
  };
  var show4 = (deps) => {
    const { rankIndex, onSelect, onBack } = deps;
    const body = mountScreenShell("heli-select", I18N.HELI_SELECT_TITLE, I18N.HELI_SELECT_SUB, onBack);
    const visibleTypes = HELI_TYPES.filter((ht) => !(ht.hideWhenLocked && ht.minRankIndex > rankIndex));
    const carousel = createSwipeCarousel({
      items: visibleTypes,
      isLocked: (ht) => ht.minRankIndex > rankIndex,
      renderCard: (ht, locked) => {
        const card = document.createElement("div");
        const lockLabel = locked ? `<div class="box-sub heli-lock-label heli-card-label-sub">${I18N.HELI_LOCKED_FROM(RANKS[ht.minRankIndex].name.toUpperCase())}</div>` : `<div class="box-sub heli-cap-label heli-card-label-sub">${ht.selectCap}</div>`;
        card.innerHTML = `
                <canvas id="icon-${ht.id}" class="heli-card-canvas"></canvas>
                <div class="heli-card-label">
                    <div class="box-label">${ht.selectLabel}</div>
                    ${lockLabel}
                </div>`;
        return card;
      },
      renderDetail: (ht, _close) => {
        const locked = ht.minRankIndex > rankIndex;
        if (locked) return null;
        _activeHeliId = ht.id;
        _overlayAngle = _G.menuAngles[ht.id];
        return _buildOverlayDetail(ht, onSelect);
      },
      onDetailClose: () => {
        _activeHeliId = null;
      }
    });
    body.appendChild(carousel);
    showScreenCrtEnter("heli-select");
    animateHeliPreviews();
  };

  // ../src/game/ui/settings/settings.css
  var __el9 = document.createElement("style");
  __el9.textContent = "/* \u2500\u2500\u2500 settings screen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#settings-screen .title {\n    font-size: 28px;\n    margin-bottom: 0;\n}\n\n#settings-screen {\n    position: absolute;\n    top: 0; left: 0; width: 100%; height: 100%;\n    background: rgba(5, 5, 5, 0.92);\n    display: none;\n    flex-direction: column;\n    justify-content: safe center;\n    align-items: center;\n    z-index: 200;\n    cursor: default;\n    gap: 12px;\n}\n#settings-screen .subtitle {\n    margin-bottom: 0;\n}\n#settings-screen .screen-body {\n    gap: 22px;\n}\n@media (max-height: 600px) {\n    #settings-screen .screen-body { gap: 14px; }\n}\n#settings-stats {\n    color: #444;\n    font-size: 13px;\n    letter-spacing: 2px;\n    margin-top: -8px;\n}\n.settings-field {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    gap: 8px;\n}\n.settings-field label {\n    font-size: 11px;\n    color: #555;\n    letter-spacing: 4px;\n}\n.settings-field input {\n    background: #0a0a0a;\n    border: 1px solid #3a3a2a;\n    color: #ffcc00;\n    font-family: monospace;\n    font-size: 18px;\n    letter-spacing: 3px;\n    text-align: center;\n    padding: 8px 20px;\n    outline: none;\n    width: 220px;\n}\n.settings-field input:focus {\n    border-color: #cc9900;\n    box-shadow: 0 0 10px rgba(204, 153, 0, 0.2);\n}\n#settings-code-display {\n    font-size: 22px;\n    color: #ffcc00;\n    letter-spacing: 6px;\n    background: #050a1a;\n    border: 1px solid #2a2a1a;\n    padding: 10px 22px;\n    text-shadow: 0 0 8px rgba(255, 204, 0, 0.4);\n    font-family: monospace;\n}\n.settings-btn {\n    font-family: monospace;\n    font-size: 12px;\n    letter-spacing: 3px;\n    color: #5f5;\n    border: 1px solid #2a4a2a;\n    background: none;\n    cursor: pointer;\n    padding: 8px 16px;\n    transition: all 0.2s;\n}\n.settings-btn:hover {\n    border-color: #5f5;\n    box-shadow: 0 0 8px rgba(85, 255, 85, 0.2);\n}\n#import-code-input {\n    width: 200px;\n    letter-spacing: 4px;\n    text-transform: uppercase;\n}\n";
  document.head.appendChild(__el9);

  // ../src/game/ui/rankup/rankup.css
  var __el10 = document.createElement("style");
  __el10.textContent = ".rank-board {\n    display: inline-flex;\n    flex-direction: column;\n    align-items: center;\n    gap: 8px;\n    background: #050a1a;\n    border: 2px solid #cc9900;\n    border-radius: 4px;\n    padding: 14px 36px;\n    min-width: 150px;\n}\n.rank-pips {\n    font-size: 28px;\n    color: #ffcc00;\n    letter-spacing: 10px;\n    text-shadow: 0 0 10px rgba(255, 204, 0, 0.6);\n}\n.rank-board.major .rank-pips {\n    font-size: 32px;\n    color: #ffdd44;\n    letter-spacing: 4px;\n    text-shadow: 0 0 16px rgba(255, 220, 68, 0.8);\n}\n.rank-label {\n    font-size: 11px;\n    color: #887700;\n    letter-spacing: 5px;\n}\n\n#rankup-overlay {\n    position: absolute;\n    inset: 0;\n    background: rgba(0, 4, 18, 0.97);\n    display: none;\n    flex-direction: column;\n    justify-content: safe center;\n    align-items: center;\n    z-index: 600;\n    cursor: pointer;\n    gap: 28px;\n}\n@keyframes rankup-pulse {\n    0%, 100% { transform: scale(1); }\n    50%       { transform: scale(1.06); }\n}\n#rankup-badge { animation: rankup-pulse 1.8s ease-in-out infinite; }\n\n#rankup-main {\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    gap: 40px;\n}\n\n#rankup-heli {\n    align-items: center;\n}\n\n#rankup-heli-canvas {\n    width: 200px;\n    height: 160px;\n    display: block;\n    background: #050a1a;\n    border: 2px solid #cc9900;\n    border-radius: 4px;\n}\n";
  document.head.appendChild(__el10);

  // ../src/game/ui/rankup/rankup.ui.ts
  var _drawHeli2 = null;
  var init = (drawHeli) => {
    _drawHeli2 = drawHeli;
  };
  var rankBadgeHtml = (rank) => `<div class="rank-board${rank.name === "Major" ? " major" : ""}"><span class="rank-pips">${rank.pips}</span><span class="rank-label">${rank.name.toUpperCase()}</span></div>`;
  var hide2 = () => {
    _heliId = null;
    _animRunning = false;
    document.getElementById("rankup-overlay").style.display = "none";
  };
  var mount6 = () => {
    const el2 = ensureEl("rankup-overlay");
    el2.innerHTML = `
        <div id="rankup-main">
            <div id="rankup-badge"></div>
            <div id="rankup-heli" style="display:none">
                <canvas id="rankup-heli-canvas"></canvas>
            </div>
        </div>
        <p class="start-hint" style="color: #cc9900; margin-top: 10px">${I18N.NEXT}</p>`;
    el2.addEventListener("click", hide2);
  };
  var _heliId = null;
  var _animAngle = 0;
  var _animRotor = 0;
  var _animRunning = false;
  var _animLoop = () => {
    const overlay = document.getElementById("rankup-overlay");
    if (!overlay || overlay.style.display === "none" || !_drawHeli2 || !_heliId) {
      _animRunning = false;
      return;
    }
    const c = document.getElementById("rankup-heli-canvas");
    if (!c) {
      _animRunning = false;
      return;
    }
    const W = Math.round(200 * CANVAS_SCALE);
    const H = Math.round(160 * CANVAS_SCALE);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    } else {
      c.getContext("2d").clearRect(0, 0, W, H);
    }
    _animAngle += 9e-3;
    _animRotor += 0.18;
    const ctx2d = c.getContext("2d");
    const offIso = (wx, wy, wz, camX, camY) => iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
    _drawHeli2(_heliId, 0, 0, 0, _animAngle, 0, 0, _animRotor, 0, 0, {
      targetCtx: ctx2d,
      targetIso: offIso,
      scaleOverride: 0.7
    });
    requestAnimationFrame(_animLoop);
  };
  var show5 = (rank, unlockedHeli) => {
    document.getElementById("rankup-badge").innerHTML = rankBadgeHtml(rank);
    const heliEl = document.getElementById("rankup-heli");
    if (unlockedHeli) {
      _heliId = unlockedHeli;
      _animAngle = 0;
      _animRotor = 0;
      heliEl.style.display = "flex";
      if (!_animRunning) {
        _animRunning = true;
        requestAnimationFrame(_animLoop);
      }
    } else {
      _heliId = null;
      heliEl.style.display = "none";
    }
    document.getElementById("rankup-overlay").style.display = "flex";
  };

  // ../src/game/ui/settings/settings.ui.ts
  var _deps;
  var init2 = (deps) => {
    _deps = deps;
  };
  var mount7 = () => {
    const body = mountScreenShell("settings-screen", I18N.MENU_SETTINGS, I18N.PILOT_HEADING, hide3);
    body.innerHTML = `
        <div id="settings-badge"></div>
        <div class="settings-field">
            <label>${I18N.PILOT_CALLSIGN}</label>
            <input id="player-name-input" type="text" maxlength="5" placeholder="\u2014" />
        </div>
        <div id="settings-stats"></div>
        <div class="settings-field" style="margin-top: 8px">
            <label>${I18N.PILOT_SAVECODE}</label>
            <div id="settings-code-display">\u2014</div>
        </div>
        <div class="settings-field">
            <label>${I18N.PILOT_IMPORT}</label>
            <div style="display:flex; gap: 10px; align-items: center">
                <input id="import-code-input" class="settings-field input" type="text" maxlength="10" placeholder="XXXXX-XXXX" />
                <button class="settings-btn" id="apply-save-code-btn">${I18N.PILOT_IMPORTLOAD}</button>
            </div>
            <div id="import-code-msg" style="font-size: 12px; letter-spacing: 2px; min-height: 18px; margin-top: 4px"></div>
        </div>
        <div id="settings-ctrl-row" style="display:none; flex-direction:column; align-items:center; margin-top:16px; width:100%">
            <div class="settings-field" style="width:100%">
                <label>${I18N.CONTROLS_HEADING}</label>
                <div style="display:flex; gap:10px; margin-top:6px">
                    <button class="settings-btn" id="ctrl-btn-profi">${I18N.CONTROLS_SIMPLIFIED}</button>
                    <button class="settings-btn" id="ctrl-btn-vereinfacht">${I18N.CONTROLS_PROFESSIONAL}</button>
                </div>
                <div id="ctrl-mode-hint" style="font-size:11px; letter-spacing:1px; color:#8af; margin-top:4px; min-height:16px"></div>
            </div>
        </div>
        <div style="margin-top: 20px; border-top: 1px solid #1a1a2e; padding-top: 16px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px">
            <div class="settings-field" style="width:100%">
                <label>${I18N.MUSIC_HEADING}</label>
                <div style="display:flex; gap:10px; margin-top:6px">
                    <button class="settings-btn" id="music-on-btn">${I18N.AUDIO_ON}</button>
                    <button class="settings-btn" id="music-off-btn">${I18N.AUDIO_OFF}</button>
                </div>
            </div>
            <div class="settings-field" style="width:100%">
                <label>${I18N.SFX_HEADING}</label>
                <div style="display:flex; gap:10px; margin-top:6px">
                    <button class="settings-btn" id="sfx-on-btn">${I18N.AUDIO_ON}</button>
                    <button class="settings-btn" id="sfx-off-btn">${I18N.AUDIO_OFF}</button>
                </div>
            </div>
            <div class="settings-field" style="width:100%">
                <label>${I18N.LANGUAGE_HEADING}</label>
                <div style="display:flex; gap:10px; margin-top:6px">
                    <button class="settings-btn" id="lang-de-btn">DEUTSCH</button>
                    <button class="settings-btn" id="lang-en-btn">ENGLISH</button>
                </div>
            </div>
        </div>
        <div style="margin-top: 20px; border-top: 1px solid #1a1a2e; padding-top: 16px; width: 100%; display: flex; flex-direction: column; align-items: center">
            <button id="delete-session-btn" class="settings-btn" style="background: #1a0000; border-color: #500; color: #c44">${I18N.DELETE_SESSION}</button>
            <div id="delete-session-msg" style="font-size: 12px; letter-spacing: 2px; color: #c44; min-height: 18px; margin-top: 6px"></div>
        </div>
        `;
    document.getElementById("apply-save-code-btn").addEventListener("click", applySaveCode);
    document.getElementById("delete-session-btn").addEventListener("click", deleteSessionData);
    document.getElementById("music-on-btn").addEventListener("click", () => {
      _deps.setMusicEnabled(true);
      _refreshAudioButtons();
    });
    document.getElementById("music-off-btn").addEventListener("click", () => {
      _deps.setMusicEnabled(false);
      _refreshAudioButtons();
    });
    document.getElementById("sfx-on-btn").addEventListener("click", () => {
      _deps.setSfxEnabled(true);
      _refreshAudioButtons();
    });
    document.getElementById("sfx-off-btn").addEventListener("click", () => {
      _deps.setSfxEnabled(false);
      _refreshAudioButtons();
    });
    document.getElementById("lang-de-btn").addEventListener("click", () => {
      setLanguage("de");
      show6();
    });
    document.getElementById("lang-en-btn").addEventListener("click", () => {
      setLanguage("en");
      show6();
    });
    document.getElementById("ctrl-btn-profi").addEventListener("click", () => {
      _deps.setControlMode("heading");
      _refreshCtrlButtons();
    });
    document.getElementById("ctrl-btn-vereinfacht").addEventListener("click", () => {
      _deps.setControlMode("screen");
      _refreshCtrlButtons();
    });
  };
  var HL = "var(--accent, #4af)";
  var _refreshAudioButtons = () => {
    const musicOn = document.getElementById("music-on-btn");
    const musicOff = document.getElementById("music-off-btn");
    const sfxOn = document.getElementById("sfx-on-btn");
    const sfxOff = document.getElementById("sfx-off-btn");
    const music = _deps.isMusicEnabled();
    const sfx = _deps.isSfxEnabled();
    musicOn.style.borderColor = music ? HL : "";
    musicOn.style.color = music ? HL : "";
    musicOff.style.borderColor = music ? "" : HL;
    musicOff.style.color = music ? "" : HL;
    sfxOn.style.borderColor = sfx ? HL : "";
    sfxOn.style.color = sfx ? HL : "";
    sfxOff.style.borderColor = sfx ? "" : HL;
    sfxOff.style.color = sfx ? "" : HL;
  };
  var _refreshLangButtons = () => {
    const de = document.getElementById("lang-de-btn");
    const en = document.getElementById("lang-en-btn");
    if (!de || !en) return;
    de.style.borderColor = LANG === "de" ? HL : "";
    de.style.color = LANG === "de" ? HL : "";
    en.style.borderColor = LANG === "en" ? HL : "";
    en.style.color = LANG === "en" ? HL : "";
  };
  var _refreshCtrlButtons = () => {
    const mode = _deps.getControlMode();
    const profi = document.getElementById("ctrl-btn-profi");
    const vereinfacht = document.getElementById("ctrl-btn-vereinfacht");
    const hint = document.getElementById("ctrl-mode-hint");
    profi.style.borderColor = mode === "heading" ? HL : "";
    profi.style.color = mode === "heading" ? HL : "";
    vereinfacht.style.borderColor = mode === "screen" ? HL : "";
    vereinfacht.style.color = mode === "screen" ? HL : "";
    hint.textContent = mode === "heading" ? I18N.CONTROLS_SIMPLIFIED_DETAILS : I18N.CONTROLS_PROFESSIONAL_DETAILS;
  };
  var _refreshSettingsScreen = () => {
    const session2 = _deps.getSession();
    const rank = getRank(session2, _deps.getRankMissions());
    document.getElementById("settings-badge").innerHTML = rankBadgeHtml(rank);
    document.getElementById("settings-code-display").textContent = encodeSession(session2, _deps.getRankMissions());
    const statsEl = document.getElementById("settings-stats");
    const noSave = !session2.cookieConsent ? I18N.NO_SAVE_STATE : "";
    statsEl.textContent = I18N.STATS(getCampaignsDone(session2), getMissionsDone(session2)) + noSave;
  };
  var show6 = () => {
    _refreshSettingsScreen();
    const session2 = _deps.getSession();
    const input = document.getElementById("player-name-input");
    input.value = session2.playerName || "";
    input.oninput = () => {
      session2.playerName = input.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
      input.value = session2.playerName;
      _deps.saveSession(session2);
      _refreshSettingsScreen();
    };
    document.getElementById("import-code-input").value = "";
    document.getElementById("import-code-msg").textContent = "";
    const ctrlRow = document.getElementById("settings-ctrl-row");
    if (_deps.isTouchDevice()) {
      ctrlRow.style.display = "flex";
      _refreshCtrlButtons();
    } else {
      ctrlRow.style.display = "none";
    }
    _refreshAudioButtons();
    _refreshLangButtons();
    showScreenCrtEnter("settings-screen");
  };
  var hide3 = () => {
    showScreen("main-menu");
    _deps.onBack();
  };
  var applySaveCode = () => {
    const input = document.getElementById("import-code-input");
    const msg = document.getElementById("import-code-msg");
    const decoded = decodeSession(input.value.trim());
    if (!decoded) {
      msg.style.color = "#f44";
      msg.textContent = I18N.SAVE_CODE_INVALID;
      return;
    }
    const session2 = _deps.getSession();
    Object.assign(session2, decoded);
    _deps.saveSession(session2);
    input.value = "";
    msg.style.color = "#5f5";
    msg.textContent = I18N.SAVE_CODE_LOADED;
    _refreshSettingsScreen();
    document.getElementById("player-name-input").value = session2.playerName || "";
  };
  var deleteSessionData = () => {
    const btn = document.getElementById("delete-session-btn");
    btn.textContent = I18N.DELETE_CONFIRM;
    btn.onclick = _confirmDeleteSession;
  };
  var _confirmDeleteSession = () => {
    const msg = document.getElementById("delete-session-msg");
    msg.textContent = I18N.SESSION_DELETED;
    storageRemove(STORAGE_KEY);
    setTimeout(() => window.location.reload(), 1200);
  };

  // ../src/game/ui/legal-screen/legal-screen.css
  var __el11 = document.createElement("style");
  __el11.textContent = "#legal-screen {\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    background: rgba(5, 5, 5, 0.88);\n    display: none;\n    flex-direction: column;\n    justify-content: safe center;\n    align-items: center;\n    z-index: 200;\n    cursor: default;\n}\n\n.legal-content {\n    max-width: 640px;\n    width: 100%;\n    padding: 0 24px;\n    box-sizing: border-box;\n}\n\n.legal-section-heading {\n    font-size: 12px;\n    color: #ff6600;\n    letter-spacing: 4px;\n    font-weight: bold;\n    margin: 24px 0 10px;\n    border-bottom: 1px solid #1a1a1a;\n    padding-bottom: 6px;\n}\n\n.legal-para {\n    font-size: 12px;\n    color: #666;\n    line-height: 1.8;\n    margin: 4px 0;\n    letter-spacing: 0.5px;\n}\n\n.legal-spacer {\n    height: 8px;\n}\n\n@media (max-height: 520px) {\n    .legal-section-heading { margin-top: 14px; }\n    .legal-para { font-size: 11px; line-height: 1.6; }\n}\n";
  document.head.appendChild(__el11);

  // ../src/game/ui/legal-screen/legal-screen.ui.ts
  var _IS_APP6 = false;
  var _addParagraphs = (parent, lines) => {
    lines.forEach((line) => {
      const el2 = document.createElement("div");
      el2.className = line === "" ? "legal-spacer" : "legal-para";
      el2.textContent = line;
      parent.appendChild(el2);
    });
  };
  var mount8 = (onBack) => {
    const root = ensureEl("legal-screen");
    if (root.children.length > 0) return;
    const body = mountScreenShell("legal-screen", I18N.LEGAL_TITLE, "", onBack);
    const content = document.createElement("div");
    content.className = "legal-content";
    const impHead = document.createElement("div");
    impHead.className = "legal-section-heading";
    impHead.textContent = I18N.LEGAL_IMPRESSUM_HEADING;
    content.appendChild(impHead);
    _addParagraphs(content, I18N.LEGAL_IMPRESSUM);
    const dsHead = document.createElement("div");
    dsHead.className = "legal-section-heading";
    dsHead.textContent = I18N.LEGAL_DATENSCHUTZ_HEADING;
    content.appendChild(dsHead);
    _addParagraphs(content, I18N.LEGAL_DATENSCHUTZ);
    if (!_IS_APP6) {
      const stunText = I18N.LEGAL_DATENSCHUTZ_WEB;
      if (stunText) {
        const p = document.createElement("div");
        p.className = "legal-para";
        p.textContent = stunText;
        content.appendChild(p);
      }
    }
    body.appendChild(content);
  };
  var show7 = () => {
    showScreenCrtEnter("legal-screen");
  };

  // ../src/game/ui/cookie-banner/cookie-banner.css
  var __el12 = document.createElement("style");
  __el12.textContent = "/* \u2500\u2500\u2500 cookie banner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#cookie-banner {\n    position: absolute;\n    inset: 0;\n    background: rgba(0, 0, 0, 0.92);\n    display: none;\n    flex-direction: column;\n    justify-content: flex-start;\n    align-items: center;\n    overflow-y: auto;\n    padding: 40px 16px;\n    z-index: 200;\n}\n#cookie-inner {\n    background: #080808;\n    border: 1px solid #2a2a2a;\n    border-top: 2px solid #cc9900;\n    padding: 28px 32px;\n    width: min(460px, 100%);\n    box-sizing: border-box;\n    flex-shrink: 0;\n    display: flex;\n    flex-direction: column;\n    gap: 14px;\n    font-size: 14px;\n    color: #777;\n    line-height: 1.75;\n    letter-spacing: 1px;\n}\n#cookie-buttons {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 12px;\n    margin-top: 6px;\n    justify-content: center;\n}\n#cookie-buttons button {\n    font-family: monospace;\n    font-size: 12px;\n    letter-spacing: 4px;\n    font-weight: bold;\n    cursor: pointer;\n    padding: 10px 28px;\n    border: 1px solid;\n    background: none;\n    transition: all 0.2s;\n}\n#cookie-buttons button.approve {\n    color: #5f5;\n    border-color: #2a4a2a;\n}\n#cookie-buttons button.approve:hover {\n    background: rgba(0, 80, 0, 0.3);\n    border-color: #5f5;\n    box-shadow: 0 0 12px rgba(85, 255, 85, 0.2);\n}\n#cookie-buttons button.decline {\n    color: #444;\n    border-color: #222;\n}\n#cookie-buttons button.decline:hover {\n    color: #777;\n    border-color: #444;\n}\n.cookie-lang-row {\n    display: flex;\n    gap: 8px;\n    justify-content: center;\n    margin-bottom: 4px;\n}\n.cookie-lang-btn {\n    font-family: monospace;\n    font-size: 11px;\n    letter-spacing: 3px;\n    color: #444;\n    border: 1px solid #222;\n    background: none;\n    cursor: pointer;\n    padding: 5px 14px;\n    transition: all 0.15s;\n}\n.cookie-lang-btn.active {\n    color: #cc9900;\n    border-color: #cc9900;\n}\n.cookie-lang-btn:hover:not(.active) {\n    color: #666;\n    border-color: #444;\n}\n";
  document.head.appendChild(__el12);

  // ../src/game/ui/cookie-banner/cookie-banner.ui.ts
  var _IS_APP7 = false;
  var _onConsent = null;
  var _hasExistingData = () => storageGet(STORAGE_KEY) !== null;
  var _html = () => {
    const de = LANG === "de";
    const hasData = _hasExistingData();
    return `<div id="cookie-inner">
        <div class="cookie-lang-row">
            <button class="cookie-lang-btn${de ? " active" : ""}" data-lang="de">DEUTSCH</button>
            <button class="cookie-lang-btn${!de ? " active" : ""}" data-lang="en">ENGLISH</button>
        </div>
        <div style="color:#cc9900;font-size:15px;letter-spacing:5px;font-weight:bold">${de ? "DATENSCHUTZ" : "PRIVACY"}</div>
        <p>${de ? 'SAR: Callsign WOLF kann folgende Daten <strong style="color:#aaa">ausschlie\xDFlich lokal</strong> in deinem Browser (localStorage) speichern \u2013 aber nur mit deiner Einwilligung:' : 'SAR: Callsign WOLF can store the following data <strong style="color:#aaa">exclusively local</strong> in your browser (localStorage) \u2013 but only with your consent:'}</p>
        <p style="color:#555;font-size:13px;line-height:1.6">${de ? "\u25B8 Rufzeichen &nbsp;\u25B8 Dienstgrad &nbsp;\u25B8 Kampagnenfortschritt &nbsp;\u25B8 Einwilligungsstatus &nbsp;\u25B8 Spracheinstellung" : "\u25B8 Callsign &nbsp;\u25B8 Rank &nbsp;\u25B8 Campaign progress &nbsp;\u25B8 Consent status &nbsp;\u25B8 Language setting"}</p>
        <p>${de ? '<strong style="color:#aaa">Zustimmen:</strong> Daten werden lokal gespeichert \u2013 dein Fortschritt bleibt dauerhaft erhalten. <strong style="color:#aaa">Ablehnen:</strong> Es werden keine Daten gespeichert \u2013 das Spiel ist trotzdem vollst\xE4ndig spielbar, jedoch ohne dauerhaften Fortschritt.' : '<strong style="color:#aaa">Accept:</strong> Data is stored locally \u2013 your progress is saved permanently. <strong style="color:#aaa">Decline:</strong> No data is stored \u2013 the game is fully playable, but without persistent progress.'}</p>
        <p>${de ? 'Unabh\xE4ngig davon wird die Steuerungseinstellung <strong style="color:#aaa">immer lokal</strong> gespeichert, da es sich um eine rein technische Ger\xE4teeinstellung handelt (kein Personenbezug).' : 'Independently, the control setting is <strong style="color:#aaa">always stored locally</strong>, as it is a purely technical device setting (no personal data).'}</p>
        ${!_IS_APP7 ? `<p style="border-top:1px solid #1a2a1a;padding-top:10px;margin-top:4px">
            <strong style="color:#cc9900">${de ? "MULTIPLAYER-MODUS:" : "MULTIPLAYER MODE:"}</strong>
            ${de ? 'Wenn du eine Multiplayer-Verbindung aufbaust, werden zur Vermittlung der direkten Peer-to-Peer-Verbindung <strong style="color:#aaa">Google STUN-Server</strong> (stun.l.google.com) kontaktiert. Dabei wird deine <strong style="color:#aaa">IP-Adresse</strong> an Google \xFCbermittelt. Dies geschieht ausschlie\xDFlich auf deine aktive Veranlassung hin und nur f\xFCr die Dauer des Verbindungsaufbaus. Google setzt dabei <strong style="color:#aaa">keine Cookies</strong>. Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO.' : 'When you establish a multiplayer connection, <strong style="color:#aaa">Google STUN servers</strong> (stun.l.google.com) are contacted to broker the direct peer-to-peer connection. Your <strong style="color:#aaa">IP address</strong> is transmitted to Google solely at your active initiative and only for the duration of the connection setup. Google does <strong style="color:#aaa">not set any cookies</strong>. Legal basis: Art.&nbsp;6 para.&nbsp;1 lit.&nbsp;b GDPR.'}
        </p>` : ""}
        <p style="color:#444;font-size:12px">${de ? 'Rechtsgrundlage f\xFCr die lokale Speicherung: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;a DSGVO (Einwilligung). Gespeicherte Daten k\xF6nnen jederzeit \xFCber <strong style="color:#555">Hauptmen\xFC \u2192 Einstellungen \u2192 Spielstand l\xF6schen</strong> unwiderruflich gel\xF6scht werden.' : 'Legal basis for local storage: Art.&nbsp;6 para.&nbsp;1 lit.&nbsp;a GDPR (consent). Stored data can be deleted at any time via <strong style="color:#555">Main Menu \u2192 Settings \u2192 Delete Save</strong>.'}</p>
        <div id="cookie-buttons">
            <button class="approve" onclick="approveCookies()">${de ? "ZUSTIMMEN" : "ACCEPT"}</button>
            <button class="decline" onclick="declineCookies()">${de ? "ABLEHNEN" : "DECLINE"}</button>
            ${hasData ? `<button class="decline" style="background:#1a0000;border-color:#500;color:#c44" onclick="confirmDeleteSession()">${de ? "WIDERRUFEN & L\xD6SCHEN" : "REVOKE & DELETE"}</button>` : ""}
        </div>
    </div>`;
  };
  var mount9 = (onConsent) => {
    _onConsent = onConsent ?? null;
    const el2 = ensureEl("cookie-banner");
    el2.innerHTML = _html();
    el2.addEventListener("click", (e) => {
      const lang = e.target.dataset.lang;
      if (lang === "de" || lang === "en") setLanguage(lang);
    });
  };
  onLanguageChange(() => {
    const el2 = document.getElementById("cookie-banner");
    if (el2) el2.innerHTML = _html();
  });

  // ../src/game/ui/loading-screen/loading-screen.css
  var __el13 = document.createElement("style");
  __el13.textContent = "#loading-screen {\n    display: none;\n    position: fixed;\n    inset: 0;\n    background: #050505;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    z-index: 900;\n    gap: 20px;\n    opacity: 1;\n    transition: opacity 0.3s ease;\n}\n\n#loading-screen.loading-fade-out {\n    opacity: 0;\n}\n\n#loading-screen .loading-title {\n    font-size: clamp(22px, 5vw, 42px);\n    color: #ff6600;\n    text-shadow: 0 0 20px #ff6600;\n    letter-spacing: 4px;\n    font-weight: bold;\n    text-align: center;\n    padding: 0 20px;\n}\n\n#loading-screen .loading-bar-track {\n    width: min(400px, 80vw);\n    height: 3px;\n    background: #1a1a1a;\n    overflow: hidden;\n}\n\n#loading-screen .loading-bar-fill {\n    height: 100%;\n    width: 0%;\n    background: #5f5;\n    transition: width 0.25s ease;\n}\n\n#loading-screen .loading-label {\n    font-size: 11px;\n    letter-spacing: 4px;\n    color: #3a6e3a;\n    text-transform: uppercase;\n    min-height: 1em;\n}\n";
  document.head.appendChild(__el13);

  // ../src/game/ui/loading-screen/loading-screen.ui.ts
  var MIN_MS = 1e3;
  var show8 = (title) => {
    const el2 = ensureEl("loading-screen");
    el2.innerHTML = `
        <div class="loading-title">${title}</div>
        <div class="loading-bar-track"><div class="loading-bar-fill"></div></div>
        <div class="loading-label"></div>
    `;
    el2.style.display = "flex";
    const startTime = Date.now();
    const fill = el2.querySelector(".loading-bar-fill");
    const labelEl = el2.querySelector(".loading-label");
    return {
      step(label, progress) {
        labelEl.textContent = label;
        fill.style.width = `${progress * 100}%`;
      },
      async done() {
        const elapsed = Date.now() - startTime;
        const remaining = MIN_MS - elapsed;
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
        el2.classList.add("loading-fade-out");
        await new Promise((r) => setTimeout(r, 350));
        el2.style.display = "none";
        el2.classList.remove("loading-fade-out");
        el2.innerHTML = "";
      }
    };
  };

  // ../src/game/ui/pause-overlay/pause-overlay.css
  var __el14 = document.createElement("style");
  __el14.textContent = "#hud-tl {\n    position: fixed;\n    top: max(12px, env(safe-area-inset-top));\n    left: max(16px, env(safe-area-inset-left));\n    z-index: 300;\n    display: flex;\n    align-items: center;\n    gap: 8px;\n}\n\n#pause-btn {\n    cursor: pointer;\n    opacity: 0.85;\n    transition: opacity 0.15s;\n    display: none;\n    align-items: center;\n    justify-content: center;\n}\n#pause-btn:hover { opacity: 1; }\n\n#pause-overlay {\n    display: none;\n    position: fixed;\n    inset: 0;\n    z-index: 2000;\n    background: rgba(0, 0, 0, 0.82);\n    align-items: center;\n    justify-content: center;\n}\n#pause-overlay.visible {\n    display: flex;\n}\n\n#pause-panel {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    gap: 20px;\n    padding: 32px 28px;\n    background: #050d05;\n    border: 1px solid #2a4a2a;\n    box-shadow: 0 0 40px rgba(0, 255, 80, 0.06);\n    min-width: 260px;\n}\n\n#pause-title {\n    font: bold 14px monospace;\n    letter-spacing: 4px;\n    color: #5f5;\n}\n\n#pause-resume {\n    margin-top: 8px;\n    letter-spacing: 3px;\n    padding: 10px 28px;\n}\n\n.pause-field {\n    width: 100%;\n    display: flex;\n    flex-direction: column;\n    gap: 6px;\n}\n\n.pause-field label {\n    font: 11px monospace;\n    letter-spacing: 2px;\n    color: #5a5;\n}\n\n.pause-field .pause-row {\n    display: flex;\n    gap: 10px;\n}\n";
  document.head.appendChild(__el14);

  // ../src/game/ui/pause-overlay/pause-overlay.ui.ts
  var _deps2;
  var HL2 = "var(--accent, #4af)";
  var _refreshButtons = () => {
    const music = _deps2.isMusicEnabled();
    const sfx = _deps2.isSfxEnabled();
    const mode = _deps2.getControlMode();
    const set = (id, active) => {
      const el2 = document.getElementById(id);
      if (!el2) return;
      el2.style.borderColor = active ? HL2 : "";
      el2.style.color = active ? HL2 : "";
    };
    set("pause-music-on", music);
    set("pause-music-off", !music);
    set("pause-sfx-on", sfx);
    set("pause-sfx-off", !sfx);
    set("pause-ctrl-simplified", mode === "heading");
    set("pause-ctrl-profi", mode === "screen");
  };
  var _show = () => {
    _deps2.onPause();
    _refreshButtons();
    document.getElementById("pause-overlay").classList.add("visible");
  };
  var _hide = () => {
    document.getElementById("pause-overlay").classList.remove("visible");
    _deps2.onResume();
  };
  var _abort = () => {
    document.getElementById("pause-overlay").classList.remove("visible");
    _deps2.onAbort();
  };
  var show9 = () => {
    const el2 = document.getElementById("pause-btn");
    if (el2) el2.style.display = "flex";
  };
  var mount10 = (deps) => {
    _deps2 = deps;
    const container = ensureEl("hud-tl");
    let btn = document.getElementById("pause-btn");
    if (!btn) {
      btn = document.createElement("div");
      btn.id = "pause-btn";
      container.appendChild(btn);
    }
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
            <defs><filter id="glow-gear"><feGaussianBlur stdDeviation="1.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter></defs>
            <g filter="url(#glow-gear)" fill="#ff6600" stroke="#ff8800" stroke-width="0.5">
                <path d="M12.8 7.1 L13.7 2.7 L18.3 2.7 L19.2 7.1 L22.1 8.7 L26.3 7.3 L28.7 11.4 L25.4 14.4 L25.4 17.6 L28.7 20.6 L26.3 24.7 L22.1 23.3 L19.2 24.9 L18.3 29.3 L13.7 29.3 L12.8 24.9 L9.9 23.3 L5.7 24.7 L3.3 20.6 L6.6 17.6 L6.6 14.4 L3.3 11.4 L5.7 7.3 L9.9 8.7 Z"
                    fill="none" stroke="#ff6600" stroke-width="1.8" stroke-linejoin="round"/>
            </g>
        </svg>`;
    btn.onclick = _show;
    const overlay = ensureEl("pause-overlay");
    overlay.innerHTML = `
        <div id="pause-panel">
            <div id="pause-title">${I18N.PAUSE_TITLE}</div>
            <div class="pause-field">
                <label>${I18N.MUSIC_HEADING}</label>
                <div class="pause-row">
                    <button class="settings-btn" id="pause-music-on">${I18N.AUDIO_ON}</button>
                    <button class="settings-btn" id="pause-music-off">${I18N.AUDIO_OFF}</button>
                </div>
            </div>
            <div class="pause-field">
                <label>${I18N.SFX_HEADING}</label>
                <div class="pause-row">
                    <button class="settings-btn" id="pause-sfx-on">${I18N.AUDIO_ON}</button>
                    <button class="settings-btn" id="pause-sfx-off">${I18N.AUDIO_OFF}</button>
                </div>
            </div>
            <div class="pause-field">
                <label>${I18N.CONTROLS_HEADING}</label>
                <div class="pause-row">
                    <button class="settings-btn" id="pause-ctrl-simplified">${I18N.CONTROLS_SIMPLIFIED}</button>
                    <button class="settings-btn" id="pause-ctrl-profi">${I18N.CONTROLS_PROFESSIONAL}</button>
                </div>
            </div>
            <button class="settings-btn" id="pause-resume">${I18N.PAUSE_RESUME}</button>
            <button class="settings-btn" id="pause-abort" style="background:#1a0000;border-color:#500;color:#c44">${I18N.PAUSE_ABORT}</button>
        </div>`;
    document.getElementById("pause-music-on").onclick = () => {
      _deps2.setMusicEnabled(true);
      _refreshButtons();
    };
    document.getElementById("pause-music-off").onclick = () => {
      _deps2.setMusicEnabled(false);
      _refreshButtons();
    };
    document.getElementById("pause-sfx-on").onclick = () => {
      _deps2.setSfxEnabled(true);
      _refreshButtons();
    };
    document.getElementById("pause-sfx-off").onclick = () => {
      _deps2.setSfxEnabled(false);
      _refreshButtons();
    };
    document.getElementById("pause-ctrl-simplified").onclick = () => {
      _deps2.setControlMode("heading");
      _refreshButtons();
    };
    document.getElementById("pause-ctrl-profi").onclick = () => {
      _deps2.setControlMode("screen");
      _refreshButtons();
    };
    document.querySelector("#pause-panel .pause-field:last-of-type").style.display = _deps2.isTouchDevice() ? "" : "none";
    document.getElementById("pause-resume").onclick = _hide;
    document.getElementById("pause-abort").onclick = _abort;
  };

  // ../src/game/def-utils.ts
  var _rotateVerts = (verts, pivot, axis, angle) => {
    const [px, py, pz] = pivot;
    const [ax, ay, az] = axis;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const t = 1 - cos;
    return verts.map(([x, y, z]) => {
      const dx = x - px, dy = y - py, dz = z - pz;
      const dot = ax * dx + ay * dy + az * dz;
      return [
        px + dx * cos + (ay * dz - az * dy) * sin + ax * dot * t,
        py + dy * cos + (az * dx - ax * dz) * sin + ay * dot * t,
        pz + dz * cos + (ax * dy - ay * dx) * sin + az * dot * t
      ];
    });
  };
  var _buildRotFnCache = (def, params) => {
    const partMap = new Map(def.parts.map((p) => [p.id, p]));
    const cache = /* @__PURE__ */ new Map();
    const getRotFn = (partId) => {
      if (cache.has(partId)) return cache.get(partId);
      const part = partMap.get(partId);
      if (!part) {
        const identity = (v) => v;
        cache.set(partId, identity);
        return identity;
      }
      let fn;
      if (part.parent) {
        const parentFn = getRotFn(part.parent);
        if (part.rotate) {
          const angle = params[part.rotate.param] ?? 0;
          const tPivot = parentFn([part.rotate.pivot])[0];
          const { axis } = part.rotate;
          fn = (verts) => _rotateVerts(parentFn(verts), tPivot, axis, angle);
        } else {
          fn = parentFn;
        }
      } else if (part.rotate) {
        const angle = params[part.rotate.param] ?? 0;
        const { pivot, axis } = part.rotate;
        fn = (verts) => _rotateVerts(verts, pivot, axis, angle);
      } else {
        fn = (verts) => verts;
      }
      cache.set(partId, fn);
      return fn;
    };
    return getRotFn;
  };
  var applyParts = (def, params, opts) => {
    const extraFaces = [];
    if (def.parts?.length) {
      const getRotFn = _buildRotFnCache(def, params);
      for (const part of def.parts) {
        if (opts?.only && !opts.only.includes(part.id)) continue;
        const rotFn = getRotFn(part.id);
        for (const face of part.faces) {
          extraFaces.push({ ...face, verts: rotFn(face.verts) });
        }
      }
    }
    if (def.rotateNodes?.length) {
      for (const node of def.rotateNodes) {
        const angle = params[node.param] ?? 0;
        for (const face of node.faces) {
          extraFaces.push({ ...face, verts: _rotateVerts(face.verts, node.pivot, node.axis, angle) });
        }
      }
    }
    return { ...def, faces: [...def.faces, ...extraFaces] };
  };

  // ../src/game/models/fuel_truck_chassis.zdef
  var fuel_truck_chassis_default = {
    id: "fuel_truck_chassis",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "body",
        xMin: 0,
        xMax: 2.2,
        yMin: -0.45,
        yMax: 0.45,
        zMin: 0,
        zMax: 0.85
      }
    ],
    faces: [
      {
        id: "ch_top",
        verts: [
          [
            0,
            -0.45,
            0.3
          ],
          [
            2.2,
            -0.45,
            0.3
          ],
          [
            2.2,
            0.45,
            0.3
          ],
          [
            0,
            0.45,
            0.3
          ]
        ],
        color: "#4a6a4a"
      },
      {
        id: "ch_front",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.2,
            -0.45,
            0
          ],
          [
            2.2,
            0.45,
            0
          ],
          [
            2.2,
            0.45,
            0.3
          ],
          [
            2.2,
            -0.45,
            0.3
          ]
        ],
        color: "#4a6a4a"
      },
      {
        id: "ch_rear",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            0,
            0.45,
            0
          ],
          [
            0,
            -0.45,
            0
          ],
          [
            0,
            -0.45,
            0.3
          ],
          [
            0,
            0.45,
            0.3
          ]
        ],
        color: "#3a5a3a"
      },
      {
        id: "ch_right",
        normal: [
          0,
          1
        ],
        verts: [
          [
            2.2,
            0.45,
            0
          ],
          [
            0,
            0.45,
            0
          ],
          [
            0,
            0.45,
            0.3
          ],
          [
            2.2,
            0.45,
            0.3
          ]
        ],
        color: "#2a4a2a"
      },
      {
        id: "ch_left",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0,
            -0.45,
            0
          ],
          [
            2.2,
            -0.45,
            0
          ],
          [
            2.2,
            -0.45,
            0.3
          ],
          [
            0,
            -0.45,
            0.3
          ]
        ],
        color: "#2a4a2a"
      },
      {
        id: "wfl",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            1.65,
            -0.45,
            0
          ],
          [
            1.95,
            -0.45,
            0
          ],
          [
            1.95,
            -0.45,
            0.22
          ],
          [
            1.65,
            -0.45,
            0.22
          ]
        ],
        color: "#1a2e1a"
      },
      {
        id: "wfr",
        normal: [
          0,
          1
        ],
        verts: [
          [
            1.65,
            0.45,
            0
          ],
          [
            1.95,
            0.45,
            0
          ],
          [
            1.95,
            0.45,
            0.22
          ],
          [
            1.65,
            0.45,
            0.22
          ]
        ],
        color: "#1a2e1a"
      },
      {
        id: "wrl",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0.25,
            -0.45,
            0
          ],
          [
            0.55,
            -0.45,
            0
          ],
          [
            0.55,
            -0.45,
            0.22
          ],
          [
            0.25,
            -0.45,
            0.22
          ]
        ],
        color: "#1a2e1a"
      },
      {
        id: "wrr",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.25,
            0.45,
            0
          ],
          [
            0.55,
            0.45,
            0
          ],
          [
            0.55,
            0.45,
            0.22
          ],
          [
            0.25,
            0.45,
            0.22
          ]
        ],
        color: "#1a2e1a"
      }
    ]
  };

  // ../src/game/models/fuel_truck_tank.zdef
  var fuel_truck_tank_default = {
    id: "fuel_truck_tank",
    pivot: [
      0,
      0,
      0
    ],
    faces: [
      {
        id: "tk_top",
        verts: [
          [
            0.25,
            -0.38,
            1.06
          ],
          [
            1.4,
            -0.38,
            1.06
          ],
          [
            1.4,
            0.38,
            1.06
          ],
          [
            0.25,
            0.38,
            1.06
          ]
        ],
        color: "#cccccc"
      },
      {
        id: "tk_front",
        normal: [
          1,
          0
        ],
        verts: [
          [
            1.4,
            -0.38,
            0.3
          ],
          [
            1.4,
            0.38,
            0.3
          ],
          [
            1.4,
            0.38,
            1.06
          ],
          [
            1.4,
            -0.38,
            1.06
          ]
        ],
        color: "#aaaaaa"
      },
      {
        id: "tk_right",
        normal: [
          0,
          1
        ],
        verts: [
          [
            1.4,
            0.38,
            0.3
          ],
          [
            0.25,
            0.38,
            0.3
          ],
          [
            0.25,
            0.38,
            1.06
          ],
          [
            1.4,
            0.38,
            1.06
          ]
        ],
        color: "#999999"
      },
      {
        id: "tk_left",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0.25,
            -0.38,
            0.3
          ],
          [
            1.4,
            -0.38,
            0.3
          ],
          [
            1.4,
            -0.38,
            1.06
          ],
          [
            0.25,
            -0.38,
            1.06
          ]
        ],
        color: "#bbbbbb"
      },
      {
        id: "tk_rear",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            0.25,
            0.38,
            0.3
          ],
          [
            0.25,
            -0.38,
            0.3
          ],
          [
            0.25,
            -0.38,
            1.06
          ],
          [
            0.25,
            0.38,
            1.06
          ]
        ],
        color: "#aaaaaa"
      },
      {
        id: "tk_stripe",
        verts: [
          [
            0.3,
            -0.04,
            1.065
          ],
          [
            1.35,
            -0.04,
            1.065
          ],
          [
            1.35,
            0.04,
            1.065
          ],
          [
            0.3,
            0.04,
            1.065
          ]
        ],
        color: "#ff4400"
      }
    ]
  };

  // ../src/game/models/fuel_truck_cab.zdef
  var fuel_truck_cab_default = {
    id: "fuel_truck_cab",
    pivot: [
      0,
      0,
      0
    ],
    faces: [
      {
        id: "cab_top",
        verts: [
          [
            1.5,
            -0.45,
            0.85
          ],
          [
            2.2,
            -0.45,
            0.85
          ],
          [
            2.2,
            0.45,
            0.85
          ],
          [
            1.5,
            0.45,
            0.85
          ]
        ],
        color: "#6a9a6a",
        stroke: "#8aba8a"
      },
      {
        id: "cab_front",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.2,
            -0.45,
            0.3
          ],
          [
            2.2,
            0.45,
            0.3
          ],
          [
            2.2,
            0.45,
            0.85
          ],
          [
            2.2,
            -0.45,
            0.85
          ]
        ],
        color: "#3a6a3a"
      },
      {
        id: "cab_win",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.201,
            -0.25,
            0.45
          ],
          [
            2.201,
            0.25,
            0.45
          ],
          [
            2.201,
            0.25,
            0.75
          ],
          [
            2.201,
            -0.25,
            0.75
          ]
        ],
        color: "#112233"
      },
      {
        id: "cab_right",
        normal: [
          0,
          1
        ],
        verts: [
          [
            2.2,
            0.45,
            0.3
          ],
          [
            1.5,
            0.45,
            0.3
          ],
          [
            1.5,
            0.45,
            0.85
          ],
          [
            2.2,
            0.45,
            0.85
          ]
        ],
        color: "#4a7a4a"
      },
      {
        id: "cab_left",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            1.5,
            -0.45,
            0.3
          ],
          [
            2.2,
            -0.45,
            0.3
          ],
          [
            2.2,
            -0.45,
            0.85
          ],
          [
            1.5,
            -0.45,
            0.85
          ]
        ],
        color: "#5a8a5a"
      },
      {
        id: "cab_rear",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            1.5,
            0.45,
            0.3
          ],
          [
            1.5,
            -0.45,
            0.3
          ],
          [
            1.5,
            -0.45,
            0.85
          ],
          [
            1.5,
            0.45,
            0.85
          ]
        ],
        color: "#3a5a3a"
      }
    ]
  };

  // ../src/game/draw-objects.ts
  function createDrawObjects(ctx, iso2, tileW2, tileH2, SceneRenderer) {
    function _drawFace(drawCtx, isoFn, points, color, strokeColor, zOffset, cX, cY) {
      drawCtx.fillStyle = color;
      drawCtx.beginPath();
      const first = isoFn(points[0].x, points[0].y, points[0].z + zOffset, cX, cY);
      drawCtx.moveTo(first.x, first.y);
      for (let i = 1; i < points.length; i++) {
        const p = isoFn(points[i].x, points[i].y, points[i].z + zOffset, cX, cY);
        drawCtx.lineTo(p.x, p.y);
      }
      drawCtx.closePath();
      drawCtx.fill();
      if (strokeColor) {
        drawCtx.strokeStyle = strokeColor;
        drawCtx.lineWidth = 1;
        drawCtx.stroke();
      }
    }
    function drawFace(points, color, strokeColor, zOffset, cX, cY) {
      _drawFace(ctx, iso2, points, color, strokeColor, zOffset, cX, cY);
    }
    function drawTree(tX, tY, cx, cy, scale = 1, gz = 0, type = "pine", wind = { x: 0, y: 0, phase: 0 }, partyMode = false) {
      const _PARTY_GREENS = ["#00ff44", "#44ff00", "#88ff00", "#33ff33", "#00ff88", "#66ff22", "#00cc44", "#aaff00"];
      const _treeSpeed = 8e-4 + Math.abs(Math.round(tX * 7 + tY * 13)) % 7 * 22e-5;
      const _treeOff = Math.abs(tX * 31 + tY * 17) % 80;
      const _pg = (z) => _PARTY_GREENS[Math.floor(Date.now() * _treeSpeed + z * 5 + _treeOff) % _PARTY_GREENS.length];
      const _pgDark = (z) => _PARTY_GREENS[Math.floor(Date.now() * _treeSpeed + z * 5 + _treeOff + 3) % _PARTY_GREENS.length];
      if (gz < 0.05) gz = 0.05;
      const z0 = gz;
      const trunkH = 0.5 * scale;
      const trunkR = 0.08 * scale;
      const windStrength = Math.hypot(wind.x, wind.y);
      const swayPhase = wind.phase + tX * 0.3 + tY * 0.17;
      const swayX = Math.cos(swayPhase) * windStrength * 18 * scale;
      const swayY = Math.sin(swayPhase) * windStrength * 10 * scale;
      if (type !== "bush") {
        ctx.fillStyle = type === "dead" ? "#7a5a3a" : "#5a3a1a";
        for (let i = 0; i <= 6; i++) {
          const cz = z0 + i * (trunkH / 6);
          const p = iso2(tX, tY, cz, cx, cy);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, trunkR * tileW2 / 2, trunkR * tileH2 / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (type === "pine") {
        const layers = [
          {
            zBase: z0 + trunkH * 0.3,
            zTop: z0 + trunkH * 0.3 + 1.4 * scale,
            rBase: 0.9 * scale,
            color: "#1a4a1a",
            shadow: "#0f2f0f",
            sway: 0.3
          },
          {
            zBase: z0 + trunkH * 0.3 + 0.7 * scale,
            zTop: z0 + trunkH * 0.3 + 1.9 * scale,
            rBase: 0.65 * scale,
            color: "#1e5a1e",
            shadow: "#133513",
            sway: 0.65
          },
          {
            zBase: z0 + trunkH * 0.3 + 1.3 * scale,
            zTop: z0 + trunkH * 0.3 + 2.3 * scale,
            rBase: 0.4 * scale,
            color: "#246024",
            shadow: "#163a16",
            sway: 1
          }
        ];
        layers.forEach((l) => {
          for (let i = 10; i >= 0; i--) {
            const t = i / 10;
            const cz = l.zBase + t * (l.zTop - l.zBase);
            const r = l.rBase * (1 - t);
            if (r <= 0) continue;
            const p = iso2(tX, tY, cz, cx, cy);
            const ox = swayX * l.sway * (1 - t * 0.5);
            const oy = swayY * l.sway * (1 - t * 0.5);
            ctx.fillStyle = partyMode ? _pgDark(cz) : l.shadow;
            ctx.beginPath();
            ctx.ellipse(p.x + ox + 2, p.y + oy + 1, r * tileW2 / 2, r * tileH2 / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = partyMode ? _pg(cz) : l.color;
            ctx.beginPath();
            ctx.ellipse(p.x + ox, p.y + oy, r * tileW2 / 2, r * tileH2 / 2, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      } else if (type === "oak") {
        const crownZ = z0 + trunkH + 0.5 * scale;
        const crownR = 0.75 * scale;
        const sw = swayX * 0.8, sh = swayY * 0.8;
        [
          { dx: 0, dz: 0, r: crownR, col: "#2a5a10", scol: "#1a3a08" },
          { dx: -0.25 * scale, dz: 0.3 * scale, r: crownR * 0.75, col: "#336614", scol: "#1e4a0a" },
          { dx: 0.3 * scale, dz: 0.2 * scale, r: crownR * 0.7, col: "#2e6012", scol: "#1c4208" },
          { dx: -0.1 * scale, dz: 0.6 * scale, r: crownR * 0.55, col: "#3a7018", scol: "#234a0e" },
          { dx: 0.15 * scale, dz: 0.55 * scale, r: crownR * 0.5, col: "#4a8020", scol: "#2a5010" }
        ].forEach((blob) => {
          const p = iso2(tX + blob.dx * 0.3, tY, crownZ + blob.dz, cx, cy);
          const ox = sw + blob.dx * 10, oy = sh;
          const _bz = crownZ + blob.dz;
          ctx.fillStyle = partyMode ? _pgDark(_bz) : blob.scol;
          ctx.beginPath();
          ctx.ellipse(p.x + ox + 3, p.y + oy + 2, blob.r * tileW2 / 2, blob.r * tileH2 / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = partyMode ? _pg(_bz) : blob.col;
          ctx.beginPath();
          ctx.ellipse(p.x + ox, p.y + oy, blob.r * tileW2 / 2, blob.r * tileH2 / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (type === "bush") {
        const bz = z0 + 0.15 * scale;
        [
          { dx: 0, r: 0.65 * scale, col: "#1a4a0a", dz: 0 },
          { dx: -0.2 * scale, r: 0.5 * scale, col: "#2a6014", dz: 0.1 },
          { dx: 0.25 * scale, r: 0.45 * scale, col: "#266010", dz: 0.08 },
          { dx: 0, r: 0.38 * scale, col: "#347018", dz: 0.2 }
        ].forEach((blob) => {
          const p = iso2(tX + blob.dx * 0.4, tY, bz + blob.dz * scale, cx, cy);
          const ox = swayX * 0.4, oy = swayY * 0.4;
          ctx.fillStyle = partyMode ? _pg(bz + blob.dz * scale) : blob.col;
          ctx.beginPath();
          ctx.ellipse(p.x + ox, p.y + oy, blob.r * tileW2 / 2 * 1.3, blob.r * tileH2 / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (type === "dead") {
        const topZ = z0 + trunkH + 0.9 * scale;
        const ptop = iso2(tX, tY, topZ, cx, cy);
        const pbase = iso2(tX, tY, z0 + trunkH, cx, cy);
        ctx.strokeStyle = "#8a6a4a";
        ctx.lineWidth = Math.max(1.5, tileW2 * 0.06 * scale);
        ctx.beginPath();
        ctx.moveTo(pbase.x, pbase.y);
        ctx.lineTo(ptop.x, ptop.y);
        ctx.stroke();
        ctx.lineWidth = Math.max(0.8, tileW2 * 0.03 * scale);
        ctx.strokeStyle = "#7a5a3a";
        [
          { ax: -0.35, az: 0.45, bx: -0.6, bz: 0.65 },
          { ax: 0.3, az: 0.5, bx: 0.55, bz: 0.68 },
          { ax: -0.2, az: 0.72, bx: -0.38, bz: 0.88 },
          { ax: 0.22, az: 0.75, bx: 0.4, bz: 0.9 },
          { ax: 0, az: 0.85, bx: -0.15, bz: 1 }
        ].forEach((br) => {
          const pa = iso2(tX + br.ax * 0.3 * scale, tY, z0 + trunkH + br.az * scale, cx, cy);
          const pb = iso2(tX + br.bx * 0.35 * scale, tY, z0 + trunkH + br.bz * scale, cx, cy);
          const sw2 = swayX * 0.5 * (br.bz - 0.3);
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x + sw2, pb.y);
          ctx.stroke();
        });
      }
    }
    function drawPerson(pX, pY, pZ, _angle, isWaving, cx, cy, outfit, colors, submerged = false) {
      const base = iso2(pX, pY, pZ, cx, cy);
      const s = tileW2 / 64;
      const headR = Math.max(1, 2.5 * s), torsoW = Math.max(1.5, 5 * s), torsoH = Math.max(1.5, 7.5 * s), legW = Math.max(1, 2 * s), legH = Math.max(1.5, 7 * s);
      const isRescuer = outfit === "rescuer";
      const colorShirt = colors?.shirt ?? (isRescuer ? "#ff6600" : "#5a786e");
      const colorPants = colors?.pants ?? (isRescuer ? "#ff6600" : "#3b4a6b");
      const colorArm = isRescuer ? "#ff6600" : "#f2d0a4";
      const drawX = base.x, drawY = base.y;
      if (submerged) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, ctx.canvas.width, drawY - legH);
        ctx.clip();
      }
      ctx.fillStyle = colorPants;
      ctx.fillRect(drawX - torsoW / 2, drawY - legH, legW, legH);
      ctx.fillRect(drawX + torsoW / 2 - legW, drawY - legH, legW, legH);
      const torsoY = drawY - legH - torsoH;
      ctx.fillStyle = colorShirt;
      ctx.fillRect(drawX - torsoW / 2, torsoY, torsoW, torsoH);
      const headY = torsoY - headR + s;
      ctx.fillStyle = isRescuer ? "#ffffff" : "#f2d0a4";
      ctx.beginPath();
      ctx.arc(drawX, headY, headR, 0, Math.PI * 2);
      ctx.fill();
      if (isRescuer) {
        const isTravolta = colorShirt === "#ffffff";
        if (isTravolta) {
          ctx.fillStyle = "#111";
          ctx.beginPath();
          ctx.moveTo(drawX, torsoY + s);
          ctx.lineTo(drawX - 2 * s, torsoY + 4 * s);
          ctx.lineTo(drawX, torsoY + 3 * s);
          ctx.lineTo(drawX + 2 * s, torsoY + 4 * s);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.strokeStyle = "#111";
          ctx.lineWidth = Math.max(0.8, 1.2 * s);
          ctx.beginPath();
          ctx.arc(drawX, headY, headR, Math.PI * 0.9, Math.PI * 0.1, false);
          ctx.stroke();
        }
      }
      if (isWaving) {
        const waveOffset = Math.sin(Date.now() * 0.015) * 3 * s;
        const shoulderX = drawX + torsoW / 2, shoulderY = torsoY + 2 * s;
        ctx.strokeStyle = colorArm;
        ctx.lineWidth = Math.max(1, 1.5 * s);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(shoulderX + 4 * s + waveOffset, shoulderY - 5 * s);
        ctx.stroke();
      }
      if (submerged) ctx.restore();
    }
    function drawTractor(objX, objY, objAngle, deckZ, cx, cy, tx, ty, tAngle, bc, bs, bd, cc, cs, ct) {
      const cosA = Math.cos(objAngle), sinA = Math.sin(objAngle);
      const bodyL = 1, bodyW = 0.72, bodyH = 0.15;
      const isFireTractor = ct === "#eeeeee";
      const cabH = isFireTractor ? 0.22 : bodyH + 0.22;
      const cabL = isFireTractor ? bodyL * 0.75 : bodyL;
      const dZ = deckZ + 0.01, wW = 0.15, wH = 0.25;
      const cosT = Math.cos(tAngle + objAngle), sinT = Math.sin(tAngle + objAngle);
      function vt(lx, ly) {
        return lx * cosT - ly * sinT + (lx * sinT + ly * cosT) > 0;
      }
      const ox = objX + tx * cosA - ty * sinA;
      const oy = objY + tx * sinA + ty * cosA;
      function rr(rx, ry) {
        return { x: ox + rx * cosT - ry * sinT, y: oy + rx * sinT + ry * cosT };
      }
      function H(p, z) {
        return { x: p.x, y: p.y, z };
      }
      function face(pts, col, stroke) {
        drawFace(pts, col, stroke ?? null, 0, cx, cy);
      }
      if (isFireTractor) {
        const b1 = rr(0, 0), b2 = rr(bodyL, 0), b3 = rr(bodyL, bodyW), b4 = rr(0, bodyW);
        face([H(b1, dZ), H(b2, dZ), H(b3, dZ), H(b4, dZ)], bc);
        if (vt(0, -1)) face([H(b1, dZ), H(b2, dZ), H(b2, dZ + bodyH), H(b1, dZ + bodyH)], bs);
        if (vt(1, 0)) face([H(b2, dZ), H(b3, dZ), H(b3, dZ + bodyH), H(b2, dZ + bodyH)], bd);
        if (vt(0, 1)) face([H(b3, dZ), H(b4, dZ), H(b4, dZ + bodyH), H(b3, dZ + bodyH)], bs);
        if (vt(-1, 0)) face([H(b4, dZ), H(b1, dZ), H(b1, dZ + bodyH), H(b4, dZ + bodyH)], bd);
        face([H(b1, dZ + bodyH), H(b2, dZ + bodyH), H(b3, dZ + bodyH), H(b4, dZ + bodyH)], bs);
        const eqZ = dZ + bodyH, eqW = 0.2, eqL = 0.25, eqH = 0.18, eqX = bodyL - eqW - 0.02;
        const eq1 = rr(eqX, bodyW * 0.1), eq2 = rr(eqX + eqW, bodyW * 0.1);
        const eq3 = rr(eqX + eqW, bodyW * 0.1 + eqL), eq4 = rr(eqX, bodyW * 0.1 + eqL);
        face([H(eq1, eqZ), H(eq2, eqZ), H(eq3, eqZ), H(eq4, eqZ)], "#aa0000");
        if (vt(0, -1)) face([H(eq1, eqZ), H(eq2, eqZ), H(eq2, eqZ + eqH), H(eq1, eqZ + eqH)], "#ee0000");
        if (vt(1, 0)) face([H(eq2, eqZ), H(eq3, eqZ), H(eq3, eqZ + eqH), H(eq2, eqZ + eqH)], "#880000");
        if (vt(0, 1)) face([H(eq3, eqZ), H(eq4, eqZ), H(eq4, eqZ + eqH), H(eq3, eqZ + eqH)], "#aa0000");
        if (vt(-1, 0)) face([H(eq4, eqZ), H(eq1, eqZ), H(eq1, eqZ + eqH), H(eq4, eqZ + eqH)], "#880000");
        face([H(eq1, eqZ + eqH), H(eq2, eqZ + eqH), H(eq3, eqZ + eqH), H(eq4, eqZ + eqH)], "#cc0000");
      }
      const cZ = isFireTractor ? dZ + bodyH : dZ;
      const cc1 = rr(0, 0), cc2 = rr(cabL, 0), cc3 = rr(cabL, bodyW), cc4 = rr(0, bodyW);
      face([H(cc1, cZ), H(cc2, cZ), H(cc3, cZ), H(cc4, cZ)], cc);
      if (vt(0, -1)) face([H(cc1, cZ), H(cc2, cZ), H(cc2, cZ + cabH), H(cc1, cZ + cabH)], cs);
      if (vt(1, 0)) face([H(cc2, cZ), H(cc3, cZ), H(cc3, cZ + cabH), H(cc2, cZ + cabH)], bd);
      if (vt(0, 1)) face([H(cc3, cZ), H(cc4, cZ), H(cc4, cZ + cabH), H(cc3, cZ + cabH)], cc);
      if (vt(-1, 0)) face([H(cc4, cZ), H(cc1, cZ), H(cc1, cZ + cabH), H(cc4, cZ + cabH)], bd);
      face([H(cc1, cZ + cabH), H(cc2, cZ + cabH), H(cc3, cZ + cabH), H(cc4, cZ + cabH)], ct);
      [0.15, bodyL - 0.15].forEach((ax) => {
        if (vt(0, -1)) {
          const w1 = rr(ax - wW * 0.5, 0), w2 = rr(ax + wW * 0.5, 0);
          face([H(w1, dZ), H(w2, dZ), H(w2, dZ + wH), H(w1, dZ + wH)], "#222");
        }
        if (vt(0, 1)) {
          const w1 = rr(ax - wW * 0.5, bodyW), w2 = rr(ax + wW * 0.5, bodyW);
          face([H(w1, dZ), H(w2, dZ), H(w2, dZ + wH), H(w1, dZ + wH)], "#222");
        }
      });
    }
    function drawFuelTruck(tX, tY, angle, opts = {}) {
      const { z = 0, armExtend = 0, armTarget = null, getFuelingState } = opts;
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      const tkDepth = tX + tY + 0.825 * (cosA + sinA);
      const cabDepth = tX + tY + 1.85 * (cosA + sinA);
      const chDepth = Math.min(tkDepth, cabDepth) - 0.01;
      const pivotWX = tX + 0.3 * cosA;
      const pivotWY = tY + 0.3 * sinA;
      SceneRenderer.add(fuel_truck_chassis_default, { x: tX, y: tY, z, angle, depth: chDepth });
      SceneRenderer.add(fuel_truck_tank_default, { x: tX, y: tY, z, angle, depth: tkDepth });
      SceneRenderer.add(fuel_truck_cab_default, {
        x: tX,
        y: tY,
        z,
        angle,
        depth: cabDepth,
        drawFn: (camX, camY) => {
          if (armExtend <= 0) return;
          const pivotZ = z + 0.98;
          const pivotIso = iso2(pivotWX, pivotWY, pivotZ, camX, camY);
          let elbowWX, elbowWY;
          if (armTarget) {
            const dx = armTarget.x - pivotWX, dy = armTarget.y - pivotWY;
            const dist = Math.hypot(dx, dy) || 1;
            elbowWX = pivotWX + dx / dist * 0.65 * armExtend;
            elbowWY = pivotWY + dy / dist * 0.65 * armExtend;
          } else {
            elbowWX = pivotWX - cosA * 0.65 * armExtend;
            elbowWY = pivotWY - sinA * 0.65 * armExtend;
          }
          const elbowZ = pivotZ + 0.25 * Math.sin(armExtend * Math.PI * 0.7);
          const elbowIso = iso2(elbowWX, elbowWY, elbowZ, camX, camY);
          let nozzleWX, nozzleWY;
          if (armTarget) {
            const dx = armTarget.x - pivotWX, dy = armTarget.y - pivotWY;
            const dist = Math.hypot(dx, dy) || 1;
            nozzleWX = elbowWX + dx / dist * 0.5 * armExtend;
            nozzleWY = elbowWY + dy / dist * 0.5 * armExtend;
          } else {
            nozzleWX = elbowWX - cosA * 0.5 * armExtend;
            nozzleWY = elbowWY - sinA * 0.5 * armExtend;
          }
          const nozzleZ = elbowZ - 0.7 * armExtend;
          const nozzleIso = iso2(nozzleWX, nozzleWY, nozzleZ, camX, camY);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = "#777";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(pivotIso.x, pivotIso.y);
          ctx.lineTo(elbowIso.x, elbowIso.y);
          ctx.stroke();
          ctx.strokeStyle = "#aaa";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(elbowIso.x, elbowIso.y);
          ctx.lineTo(nozzleIso.x, nozzleIso.y);
          ctx.stroke();
          const as = tileW2 / 64;
          ctx.fillStyle = "#555";
          ctx.beginPath();
          ctx.arc(elbowIso.x, elbowIso.y, Math.max(1.2, 3 * as), 0, Math.PI * 2);
          ctx.fill();
          const fueling = getFuelingState ? getFuelingState() : false;
          ctx.fillStyle = fueling && Math.floor(Date.now() / 200) % 2 ? "#ff8800" : "#444";
          ctx.beginPath();
          ctx.arc(nozzleIso.x, nozzleIso.y, Math.max(1.5, 4 * as), 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
    function drawHeli(type, hX, hY, hZ, hAngle, hTilt, hRoll, hRotor, camX, camY, opts = {}) {
      const {
        targetCtx: tCtx,
        targetIso: tIso,
        isShadow = false,
        scaleOverride = 0,
        fillColor = "#ff6600",
        strokeColor = "#dd3300",
        shadowGetGround,
        flapRate = 1,
        tailRotorRate = 1
      } = opts;
      const actualCtx = tCtx ?? ctx;
      const actualIso = tIso ?? iso2;
      const cosA = Math.cos(hAngle), sinA = Math.sin(hAngle);
      const _baseScale = getHeliType(type).scale;
      let s = _baseScale;
      if (scaleOverride > 0) s = scaleOverride * _baseScale;
      const lineScale = tileW2 / 64;
      function p(lx, ly, lz) {
        lx *= s;
        ly *= s;
        lz *= s;
        lz += ly * hRoll * 0.5 + lx * hTilt * 0.5;
        const rx = lx * cosA - ly * sinA + hX;
        const ry = lx * sinA + ly * cosA + hY;
        let rz = hZ + lz;
        if (isShadow) {
          if (shadowGetGround) {
            const g = shadowGetGround(rx, ry);
            rz = g > -5 ? g : 0;
          } else {
            rz = hZ;
          }
        }
        return actualIso(rx, ry, rz, camX, camY);
      }
      function faceFn(pts, color, stroke, zOffset, cX, cY) {
        _drawFace(actualCtx, actualIso, pts, color, stroke, zOffset, cX, cY);
      }
      actualCtx.lineJoin = "round";
      actualCtx.lineCap = "round";
      if (type === "dolphin") {
        if (isShadow) {
          const groundZ = shadowGetGround ? shadowGetGround(hX, hY) : hZ;
          actualCtx.fillStyle = `rgba(0,0,0,${Math.max(0, 0.4 - (hZ - groundZ) * 0.08)})`;
          const sN = p(1.2, 0, 0), sT = p(-1.8, 0, 0), sL = p(0, 0.4, 0), sR = p(0, -0.4, 0);
          actualCtx.beginPath();
          actualCtx.moveTo(sN.x, sN.y);
          actualCtx.lineTo(sR.x, sR.y);
          actualCtx.lineTo(sT.x, sT.y);
          actualCtx.lineTo(sL.x, sL.y);
          actualCtx.fill();
          return;
        }
        actualCtx.fillStyle = fillColor;
        actualCtx.strokeStyle = strokeColor;
        actualCtx.lineWidth = 1;
        const nose = p(1.4, 0, 0.2), tailBase = p(-0.8, 0, 0.5);
        const lSide = p(0, 0.4, 0.4), rSide = p(0, -0.4, 0.4);
        actualCtx.beginPath();
        actualCtx.moveTo(nose.x, nose.y);
        actualCtx.lineTo(rSide.x, rSide.y);
        actualCtx.lineTo(tailBase.x, tailBase.y);
        actualCtx.lineTo(lSide.x, lSide.y);
        actualCtx.closePath();
        actualCtx.fill();
        actualCtx.fillStyle = "#112";
        actualCtx.beginPath();
        actualCtx.moveTo(p(1.2, 0, 0.25).x, p(1.2, 0, 0.25).y);
        actualCtx.lineTo(p(0.3, -0.3, 0.6).x, p(0.3, -0.3, 0.6).y);
        actualCtx.lineTo(p(0.3, 0.3, 0.6).x, p(0.3, 0.3, 0.6).y);
        actualCtx.fill();
        const tTop = p(-1.8, 0, 1.2), tBack = p(-2, 0, 0.4);
        actualCtx.fillStyle = fillColor;
        actualCtx.beginPath();
        actualCtx.moveTo(tailBase.x, tailBase.y);
        actualCtx.lineTo(tTop.x, tTop.y);
        actualCtx.lineTo(tBack.x, tBack.y);
        actualCtx.fill();
        const fenCen = p(-1.6, 0.01, 0.72);
        const fenE1 = p(-1.6 + 0.24, 0.01, 0.72);
        const fenE2 = p(-1.6, 0.01, 0.72 + 0.24);
        const fax = fenE1.x - fenCen.x, fay = fenE1.y - fenCen.y;
        const fbx = fenE2.x - fenCen.x, fby = fenE2.y - fenCen.y;
        const fenEllipse = (fill, stroke, lw, scale) => {
          actualCtx.beginPath();
          for (let i = 0; i <= 24; i++) {
            const a = i / 24 * Math.PI * 2;
            const ex = fenCen.x + fax * Math.cos(a) * scale + fbx * Math.sin(a) * scale;
            const ey = fenCen.y + fay * Math.cos(a) * scale + fby * Math.sin(a) * scale;
            i === 0 ? actualCtx.moveTo(ex, ey) : actualCtx.lineTo(ex, ey);
          }
          actualCtx.closePath();
          if (fill) {
            actualCtx.fillStyle = fill;
            actualCtx.fill();
          }
          if (stroke) {
            actualCtx.strokeStyle = stroke;
            actualCtx.lineWidth = lw;
            actualCtx.stroke();
          }
        };
        fenEllipse("#1a1a1a", null, 0, 1);
        actualCtx.strokeStyle = "rgba(210,235,255,0.7)";
        actualCtx.lineWidth = 1.2 * s * lineScale;
        actualCtx.lineCap = "round";
        for (let i = 0; i < 8; i++) {
          const a = hRotor * 2 * tailRotorRate + i * (Math.PI / 4);
          const ca = Math.cos(a), sa = Math.sin(a);
          actualCtx.beginPath();
          actualCtx.moveTo(
            fenCen.x + fax * ca * 0.25 + fbx * sa * 0.25,
            fenCen.y + fay * ca * 0.25 + fby * sa * 0.25
          );
          actualCtx.lineTo(
            fenCen.x + fax * ca * 0.88 + fbx * sa * 0.88,
            fenCen.y + fay * ca * 0.88 + fby * sa * 0.88
          );
          actualCtx.stroke();
        }
        fenEllipse("#444", null, 0, 0.33);
        fenEllipse(null, fillColor, 1.5 * s * lineScale, 1);
        actualCtx.strokeStyle = "rgba(220,245,255,0.5)";
        actualCtx.lineWidth = 2 * lineScale;
        const hub = p(0, 0, 0.7);
        for (let i = 0; i < 4; i++) {
          const a = hRotor + i * (Math.PI / 2);
          const end = p(Math.cos(a) * 1.8, Math.sin(a) * 1.8, 0.8);
          actualCtx.beginPath();
          actualCtx.moveTo(hub.x, hub.y);
          actualCtx.lineTo(end.x, end.y);
          actualCtx.stroke();
        }
      } else if (type === "coasthawk") {
        if (isShadow) {
          const groundZ = shadowGetGround ? shadowGetGround(hX, hY) : hZ;
          actualCtx.fillStyle = `rgba(0,0,0,${Math.max(0, 0.4 - (hZ - groundZ) * 0.08)})`;
          const sN = p(1.3, 0, 0), sT = p(-2.8, 0, 0), sL = p(0, 0.5, 0), sR = p(0, -0.5, 0);
          actualCtx.beginPath();
          actualCtx.moveTo(sN.x, sN.y);
          actualCtx.lineTo(sR.x, sR.y);
          actualCtx.lineTo(sT.x, sT.y);
          actualCtx.lineTo(sL.x, sL.y);
          actualCtx.fill();
          return;
        }
        const stabL = p(-2.4, 0.6, 0.3), stabR = p(-2.4, -0.6, 0.3);
        actualCtx.fillStyle = "#111";
        actualCtx.lineWidth = 4 * s * lineScale;
        actualCtx.strokeStyle = "#222";
        actualCtx.beginPath();
        actualCtx.moveTo(stabL.x, stabL.y);
        actualCtx.lineTo(stabR.x, stabR.y);
        actualCtx.stroke();
        actualCtx.fillStyle = fillColor;
        actualCtx.strokeStyle = strokeColor;
        actualCtx.lineWidth = 1;
        const n = p(1.3, 0, 0.3), tailBoomStart = p(-1.1, 0, 0.6);
        const bodyFL = p(0.4, 0.45, 0.4), bodyFR = p(0.4, -0.45, 0.4);
        const bodyBL = p(-1, 0.45, 0.4), bodyBR = p(-1, -0.45, 0.4);
        actualCtx.beginPath();
        actualCtx.moveTo(n.x, n.y);
        actualCtx.lineTo(bodyFR.x, bodyFR.y);
        actualCtx.lineTo(bodyBR.x, bodyBR.y);
        actualCtx.lineTo(tailBoomStart.x, tailBoomStart.y);
        actualCtx.lineTo(bodyBL.x, bodyBL.y);
        actualCtx.lineTo(bodyFL.x, bodyFL.y);
        actualCtx.fill();
        actualCtx.stroke();
        actualCtx.fillStyle = "#111";
        actualCtx.beginPath();
        actualCtx.moveTo(p(0.3, 0.47, 0.35).x, p(0.3, 0.47, 0.35).y);
        actualCtx.lineTo(p(-0.6, 0.47, 0.35).x, p(-0.6, 0.47, 0.35).y);
        actualCtx.lineTo(p(-0.6, 0.3, 0.6).x, p(-0.6, 0.3, 0.6).y);
        actualCtx.lineTo(p(0.3, 0.3, 0.6).x, p(0.3, 0.3, 0.6).y);
        actualCtx.fill();
        actualCtx.beginPath();
        actualCtx.moveTo(p(0.3, -0.47, 0.35).x, p(0.3, -0.47, 0.35).y);
        actualCtx.lineTo(p(-0.6, -0.47, 0.35).x, p(-0.6, -0.47, 0.35).y);
        actualCtx.lineTo(p(-0.6, -0.3, 0.6).x, p(-0.6, -0.3, 0.6).y);
        actualCtx.lineTo(p(0.3, -0.3, 0.6).x, p(0.3, -0.3, 0.6).y);
        actualCtx.fill();
        actualCtx.fillStyle = "#111";
        actualCtx.beginPath();
        actualCtx.moveTo(n.x, n.y);
        actualCtx.lineTo(p(0.6, 0.4, 0.6).x, p(0.6, 0.4, 0.6).y);
        actualCtx.lineTo(p(0.6, -0.4, 0.6).x, p(0.6, -0.4, 0.6).y);
        actualCtx.fill();
        actualCtx.fillStyle = "#eee";
        actualCtx.beginPath();
        actualCtx.moveTo(p(0.6, 0, 0.7).x, p(0.6, 0, 0.7).y);
        actualCtx.lineTo(p(-0.8, 0.35, 0.7).x, p(-0.8, 0.35, 0.7).y);
        actualCtx.lineTo(p(-0.8, -0.35, 0.7).x, p(-0.8, -0.35, 0.7).y);
        actualCtx.fill();
        actualCtx.fillStyle = fillColor;
        const finBase = p(-2.4, 0, 0.6), finTop = p(-2.9, 0, 1.3), finBack = p(-3, 0, 0.6);
        actualCtx.lineWidth = 6 * s * lineScale;
        actualCtx.strokeStyle = fillColor;
        actualCtx.beginPath();
        actualCtx.moveTo(tailBoomStart.x, tailBoomStart.y);
        actualCtx.lineTo(finBase.x, finBase.y);
        actualCtx.stroke();
        actualCtx.lineWidth = 1;
        actualCtx.beginPath();
        actualCtx.moveTo(finBase.x, finBase.y);
        actualCtx.lineTo(finTop.x, finTop.y);
        actualCtx.lineTo(finBack.x, finBack.y);
        actualCtx.fill();
        actualCtx.strokeStyle = "rgba(220,245,255,0.55)";
        actualCtx.lineWidth = 2 * s * lineScale;
        actualCtx.lineCap = "round";
        const trHub = p(-2.95, 0.08, 0.95);
        for (let i = 0; i < 4; i++) {
          const a = hRotor * 1.5 * tailRotorRate + i * (Math.PI / 2);
          const trEnd = p(-2.95 + Math.sin(a) * 0.55, 0.08, 0.95 + Math.cos(a) * 0.55);
          actualCtx.beginPath();
          actualCtx.moveTo(trHub.x, trHub.y);
          actualCtx.lineTo(trEnd.x, trEnd.y);
          actualCtx.stroke();
        }
        actualCtx.strokeStyle = "rgba(220,245,255,0.5)";
        actualCtx.lineWidth = 3 * s * lineScale;
        const hub = p(0, 0, 0.8);
        for (let i = 0; i < 4; i++) {
          const a = hRotor + i * (Math.PI / 2);
          const end = p(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0.85);
          actualCtx.beginPath();
          actualCtx.moveTo(hub.x, hub.y);
          actualCtx.lineTo(end.x, end.y);
          actualCtx.stroke();
        }
      } else if (type === "atlas") {
        if (isShadow) {
          const groundZ = shadowGetGround ? shadowGetGround(hX, hY) : hZ;
          actualCtx.fillStyle = `rgba(0,0,0,${Math.max(0, 0.4 - (hZ - groundZ) * 0.08)})`;
          const sN = p(2.5, 0, 0), sT = p(-2.8, 0, 0), sL = p(0, 0.8, 0), sR = p(0, -0.8, 0);
          actualCtx.beginPath();
          actualCtx.moveTo(sN.x, sN.y);
          actualCtx.lineTo(sR.x, sR.y);
          actualCtx.lineTo(sT.x, sT.y);
          actualCtx.lineTo(sL.x, sL.y);
          actualCtx.fill();
          return;
        }
        const wf = (lx, ly, lz) => ({
          x: lx * s * cosA - ly * s * sinA + hX,
          y: lx * s * sinA + ly * s * cosA + hY,
          z: hZ + (lz * s + ly * s * hRoll * 0.5 + lx * s * hTilt * 0.5)
        });
        const rB1 = wf(1.8, 0.3, 0.15), rB2 = wf(1.8, -0.3, 0.15);
        const rB3 = wf(-2, -0.3, 0.15), rB4 = wf(-2, 0.3, 0.15);
        const rM1 = wf(1.8, 0.6, 0.5), rM2 = wf(1.8, -0.6, 0.5);
        const rM3 = wf(-2, -0.6, 0.5), rM4 = wf(-2, 0.6, 0.5);
        const rT1 = wf(1.8, 0.3, 0.85), rT2 = wf(1.8, -0.3, 0.85);
        const rT3 = wf(-2, -0.3, 0.85), rT4 = wf(-2, 0.3, 0.85);
        const tailTop = wf(-2.6, 0, 1.1), tailLow = wf(-2.6, 0, 0.4);
        const nearLeft = sinA < cosA;
        if (nearLeft) {
          faceFn([rB2, rM2, rM3, rB3], fillColor, null, 0, camX, camY);
          faceFn([rM2, rT2, rT3, rM3], fillColor, null, 0, camX, camY);
          faceFn([rB1, rM1, rM4, rB4], fillColor, null, 0, camX, camY);
          faceFn([rM1, rT1, rT4, rM4], fillColor, null, 0, camX, camY);
          faceFn([wf(1.5, 0.31, 0.6), wf(1, 0.31, 0.6), wf(1, 0.31, 0.75), wf(1.5, 0.31, 0.75)], "#111", null, 0, camX, camY);
        } else {
          faceFn([rB1, rM1, rM4, rB4], fillColor, null, 0, camX, camY);
          faceFn([rM1, rT1, rT4, rM4], fillColor, null, 0, camX, camY);
          faceFn([rB2, rM2, rM3, rB3], fillColor, null, 0, camX, camY);
          faceFn([rM2, rT2, rT3, rM3], fillColor, null, 0, camX, camY);
          faceFn([wf(1.5, -0.31, 0.6), wf(1, -0.31, 0.6), wf(1, -0.31, 0.75), wf(1.5, -0.31, 0.75)], "#111", null, 0, camX, camY);
        }
        faceFn([rT1, rT2, rT3, rT4], fillColor, null, 0, camX, camY);
        if (nearLeft) {
          faceFn([rM3, rT3, tailTop, tailLow], fillColor, null, 0, camX, camY);
          faceFn([rM4, rT4, tailTop, tailLow], fillColor, null, 0, camX, camY);
        } else {
          faceFn([rM4, rT4, tailTop, tailLow], fillColor, null, 0, camX, camY);
          faceFn([rM3, rT3, tailTop, tailLow], fillColor, null, 0, camX, camY);
        }
        faceFn([rT4, rT3, tailTop], fillColor, null, 0, camX, camY);
        const nTip = wf(2.8, 0, 0.45);
        faceFn([nTip, rM2, rT2, rT1, rM1], fillColor, null, 0, camX, camY);
        faceFn([wf(2.6, 0, 0.5), wf(2.2, -0.35, 0.6), wf(2.2, 0.35, 0.6)], "#111", null, 0, camX, camY);
        const vT = wf(1.5, 0, 1.15);
        faceFn([wf(1.8, 0.3, 0.85), wf(1.8, -0.3, 0.85), vT], fillColor, null, 0, camX, camY);
        faceFn([wf(1.8, -0.3, 0.85), wf(1.2, -0.3, 0.85), vT], fillColor, null, 0, camX, camY);
        faceFn([wf(1.2, -0.3, 0.85), wf(1.2, 0.3, 0.85), vT], fillColor, null, 0, camX, camY);
        faceFn([wf(1.2, 0.3, 0.85), wf(1.8, 0.3, 0.85), vT], fillColor, null, 0, camX, camY);
        const hTop = wf(-2.3, 0, 1.8);
        faceFn([wf(-1.9, 0.3, 1), wf(-1.9, -0.3, 1), hTop], fillColor, null, 0, camX, camY);
        faceFn([wf(-1.9, -0.3, 1), wf(-2.5, -0.15, 1.1), hTop], fillColor, null, 0, camX, camY);
        faceFn([wf(-2.5, -0.15, 1.1), wf(-2.5, 0.15, 1.1), hTop], fillColor, null, 0, camX, camY);
        faceFn([wf(-2.5, 0.15, 1.1), wf(-1.9, 0.3, 1), hTop], fillColor, null, 0, camX, camY);
        actualCtx.strokeStyle = "rgba(220,245,255,0.6)";
        actualCtx.lineWidth = 3 * s * lineScale;
        const rF = p(1.5, 0, 1.15);
        for (let i = 0; i < 3; i++) {
          const a = hRotor + i * (Math.PI * 2 / 3);
          const end = p(1.5 + Math.cos(a) * 3.4, Math.sin(a) * 3.4, 1.15);
          actualCtx.beginPath();
          actualCtx.moveTo(rF.x, rF.y);
          actualCtx.lineTo(end.x, end.y);
          actualCtx.stroke();
        }
        const rR = p(-2.3, 0, 1.8);
        for (let i = 0; i < 3; i++) {
          const a = -hRotor + i * (Math.PI * 2 / 3);
          const end = p(-2.3 + Math.cos(a) * 3.4, Math.sin(a) * 3.4, 1.8);
          actualCtx.beginPath();
          actualCtx.moveTo(rR.x, rR.y);
          actualCtx.lineTo(end.x, end.y);
          actualCtx.stroke();
        }
      } else if (type === "ornithopter") {
        const flapPhase = hRotor * 0.22 * flapRate;
        const wingAngle = Math.sin(flapPhase) * 0.32;
        const wingTipAngle = Math.sin(flapPhase + 1) * 0.14;
        if (isShadow) {
          const groundZ = shadowGetGround ? shadowGetGround(hX, hY) : hZ;
          actualCtx.fillStyle = `rgba(0,0,0,${Math.max(0, 0.4 - (hZ - groundZ) * 0.08)})`;
          actualCtx.beginPath();
          actualCtx.moveTo(p(0.9, 0.35, 0).x, p(0.9, 0.35, 0).y);
          actualCtx.lineTo(p(0.9, -0.35, 0).x, p(0.9, -0.35, 0).y);
          actualCtx.lineTo(p(-1.6, -0.15, 0).x, p(-1.6, -0.15, 0).y);
          actualCtx.lineTo(p(-1.6, 0.15, 0).x, p(-1.6, 0.15, 0).y);
          actualCtx.closePath();
          actualCtx.fill();
          const wingReach = 3.5 * Math.max(0.25, Math.cos(wingAngle));
          actualCtx.beginPath();
          actualCtx.moveTo(p(0.2, 0.25, 0).x, p(0.2, 0.25, 0).y);
          actualCtx.lineTo(p(-0.7, 0.22, 0).x, p(-0.7, 0.22, 0).y);
          actualCtx.lineTo(p(-0.6, wingReach, 0).x, p(-0.6, wingReach, 0).y);
          actualCtx.lineTo(p(0.1, wingReach, 0).x, p(0.1, wingReach, 0).y);
          actualCtx.closePath();
          actualCtx.fill();
          actualCtx.beginPath();
          actualCtx.moveTo(p(0.2, -0.25, 0).x, p(0.2, -0.25, 0).y);
          actualCtx.lineTo(p(0.1, -wingReach, 0).x, p(0.1, -wingReach, 0).y);
          actualCtx.lineTo(p(-0.6, -wingReach, 0).x, p(-0.6, -wingReach, 0).y);
          actualCtx.lineTo(p(-0.7, -0.22, 0).x, p(-0.7, -0.22, 0).y);
          actualCtx.closePath();
          actualCtx.fill();
          return;
        }
        const wf = (lx, ly, lz) => ({
          x: lx * s * cosA - ly * s * sinA + hX,
          y: lx * s * sinA + ly * s * cosA + hY,
          z: hZ + (lz * s + ly * s * hRoll * 1 + lx * s * hTilt * 1)
        });
        const rollBias = hRoll * 0.15;
        const baked = applyParts(getHeliType(type).def, {
          wingAngle: wingAngle + rollBias,
          wingAngleInv: -(wingAngle - rollBias),
          wingTipAngle: wingTipAngle + rollBias * 0.5,
          wingTipAngleInv: -(wingTipAngle - rollBias * 0.5)
        });
        const sorted = [...baked.faces].map((face) => {
          const pts = face.verts.map(([lx, ly, lz]) => wf(lx, ly, lz));
          const depth = pts.reduce((sum, pt) => sum + pt.x + pt.y, 0) / pts.length;
          return { pts, color: face.color, stroke: face.stroke ?? null, depth };
        }).sort((a, b) => a.depth - b.depth);
        for (const f of sorted) {
          faceFn(f.pts, f.color, f.stroke, 0, camX, camY);
        }
      }
      if (!isShadow && SceneRenderer.debugAltitude) {
        const groundZ = shadowGetGround ? shadowGetGround(hX, hY) : 0;
        const top = actualIso(hX, hY, hZ, camX, camY);
        const bottom = actualIso(hX, hY, groundZ, camX, camY);
        actualCtx.save();
        actualCtx.strokeStyle = "rgba(255, 220, 0, 0.9)";
        actualCtx.lineWidth = 1.5 * lineScale;
        actualCtx.setLineDash([5, 4]);
        actualCtx.shadowColor = "#ffdd00";
        actualCtx.shadowBlur = 4;
        actualCtx.beginPath();
        actualCtx.moveTo(top.x, top.y);
        actualCtx.lineTo(bottom.x, bottom.y);
        actualCtx.stroke();
        actualCtx.setLineDash([]);
        actualCtx.restore();
      }
    }
    return { drawFace, drawTree, drawPerson, drawTractor, drawFuelTruck, drawHeli };
  }

  // ../src/game/ui/whats-new/whats-new.css
  var __el15 = document.createElement("style");
  __el15.textContent = "#whats-new-overlay {\n    position: absolute;\n    inset: 0;\n    background: rgba(0, 4, 18, 0.96);\n    display: none;\n    flex-direction: column;\n    justify-content: flex-start;\n    align-items: center;\n    padding: 40px 16px;\n    z-index: 200;\n    gap: 20px;\n    cursor: pointer;\n}\n#whats-new-version {\n    font-size: 11px;\n    color: #cc9900;\n    letter-spacing: 8px;\n    flex-shrink: 0;\n}\n#whats-new-title {\n    font-size: 28px;\n    color: #ffcc00;\n    letter-spacing: 4px;\n    text-shadow: 0 0 20px rgba(255, 204, 0, 0.4);\n    flex-shrink: 0;\n    text-align: center;\n}\n#whats-new-items {\n    list-style: none;\n    padding: 0;\n    margin: 0;\n    display: flex;\n    flex-direction: column;\n    gap: 10px;\n    width: min(560px, 100%);\n    text-align: center;\n    flex-shrink: 0;\n}\n#whats-new-items li {\n    font-size: 13px;\n    color: #888;\n    letter-spacing: 2px;\n    line-height: 1.6;\n}\n#whats-new-items li::before {\n    content: '\u25B8 ';\n    color: #cc9900;\n}\n#whats-new-hint {\n    font-size: 11px;\n    color: #333;\n    letter-spacing: 4px;\n    margin-top: 12px;\n    flex-shrink: 0;\n}\n";
  document.head.appendChild(__el15);

  // ../src/game/ui/whats-new/whats-new.ui.ts
  var mount11 = () => {
    const el2 = ensureEl("whats-new-overlay");
    el2.classList.add("ui-screen");
    el2.innerHTML = `
        <div id="whats-new-version">${I18N.WHATS_NEW_HEADLINE} \xB7 ${I18N.WHATS_NEW_VERSION}</div>
        <div id="whats-new-title">${I18N.WHATS_NEW_TITLE.toUpperCase()}</div>
        <ul id="whats-new-items">
            ${[...I18N.WHATS_NEW_ITEMS].map((item) => `<li>${item}</li>`).join("")}
        </ul>
        <div id="whats-new-hint">${I18N.WHATS_NEW_HINT}</div>`;
    el2.addEventListener("click", _hide2);
  };
  var show10 = (onProceed) => {
    if (loadSession().lastSeenVersion === I18N.WHATS_NEW_VERSION || !I18N.WHATS_NEW_VERSION) return false;
    _onProceed = onProceed;
    document.getElementById("whats-new-overlay").style.display = "flex";
    return true;
  };
  var _onProceed = null;
  var _hide2 = () => {
    document.getElementById("whats-new-overlay").style.display = "none";
    const s = loadSession();
    s.lastSeenVersion = I18N.WHATS_NEW_VERSION;
    saveSession(s);
    _onProceed?.();
  };

  // ../src/game/ui/credits-screen/credits-screen.css
  var __el16 = document.createElement("style");
  __el16.textContent = "/* \u2500\u2500\u2500 credits \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#credits-screen .title {\n    font-size: 42px;\n    letter-spacing: 14px;\n    margin-bottom: 44px;\n    animation: cTitlePulse 3s ease-in-out infinite;\n}\n#credits-screen {\n    position: absolute;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    background: rgba(5, 5, 5, 0.88);\n    display: none;\n    flex-direction: column;\n    justify-content: safe center;\n    align-items: center;\n    z-index: 200;\n    cursor: default;\n}\n#credits-canvas {\n    position: absolute;\n    top: 0;\n    left: 0;\n    pointer-events: none;\n}\n#credits-inner {\n    position: relative;\n    z-index: 1;\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n}\n.credits-title {\n    font-size: 42px;\n    color: #ff6600;\n    font-weight: bold;\n    letter-spacing: 14px;\n    margin-bottom: 44px;\n    animation: cTitlePulse 3s ease-in-out infinite;\n}\n@keyframes cTitlePulse {\n    0%,\n    100% {\n        text-shadow: 0 0 16px #ff6600;\n    }\n    50% {\n        text-shadow:\n            0 0 38px #ff6600,\n            0 0 70px rgba(255, 102, 0, 0.3);\n    }\n}\n.credits-section {\n    text-align: center;\n    margin: 8px 0;\n}\n.credits-role {\n    font-size: 10px;\n    color: #666;\n    letter-spacing: 4px;\n    margin-bottom: 4px;\n}\n.credits-name {\n    font-size: 19px;\n    color: #3a5a3a;\n    letter-spacing: 3px;\n    font-weight: bold;\n    opacity: 0;\n    animation: cNameIn 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;\n}\n.credits-name {\n    color: #5f5;\n}\n@keyframes cNameIn {\n    0% {\n        opacity: 0;\n        transform: translateY(12px) rotateZ(-6deg);\n        filter: brightness(8) saturate(2);\n        text-shadow: 0 0 24px rgba(80, 255, 80, 0.9);\n    }\n    55% {\n        opacity: 1;\n        transform: translateY(-2px) rotateZ(1deg);\n        filter: brightness(2.5) saturate(1.5);\n        text-shadow: 0 0 8px rgba(80, 255, 80, 0.4);\n    }\n    100% {\n        opacity: 1;\n        transform: translateY(0) rotateZ(0deg);\n        filter: brightness(1) saturate(1);\n        text-shadow: none;\n    }\n}\n.credits-divider {\n    width: 160px;\n    height: 1px;\n    background: linear-gradient(to right, transparent, #1a2a1a, transparent);\n    margin: 14px auto;\n}\n.credits-made-with {\n    font-size: 13px;\n    letter-spacing: 3px;\n    margin-top: 36px;\n    animation: cGlow 2.5s ease-in-out infinite alternate;\n}\n@keyframes cGlow {\n    from {\n        color: #2a4a2a;\n        text-shadow: none;\n    }\n    to {\n        color: #5f5;\n        text-shadow: 0 0 10px rgba(80, 255, 80, 0.25);\n    }\n}\n.credits-copyright {\n    font-size: 11px;\n    color: #666;\n    letter-spacing: 2px;\n    margin-top: 10px;\n}\n/* \u2500\u2500\u2500 credits responsive \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n@media (max-height: 520px) {\n    #credits-screen .title { font-size: 26px; letter-spacing: 8px; margin-bottom: 16px; }\n    .credits-section { margin: 4px 0; }\n    .credits-role { font-size: 9px; letter-spacing: 3px; margin-bottom: 2px; }\n    .credits-name { font-size: 14px; letter-spacing: 2px; }\n    .credits-divider { margin: 8px auto; }\n    .credits-made-with { font-size: 11px; margin-top: 14px; }\n    #credits-screen { padding-top: 12px; }\n}\n";
  document.head.appendChild(__el16);

  // ../src/game/ui/credits-screen/credits-screen.ui.ts
  var mount12 = (onBack) => {
    const root = ensureEl("credits-screen");
    if (root.children.length > 0) return;
    const body = mountScreenShell("credits-screen", I18N.MENU_CREDITS, "", onBack);
    const canvas = document.createElement("canvas");
    canvas.id = "credits-canvas";
    const inner = document.createElement("div");
    inner.id = "credits-inner";
    body.appendChild(canvas);
    body.appendChild(inner);
  };

  // ../src/game/ui/touch-controls/touch-controls.css
  var __el17 = document.createElement("style");
  __el17.textContent = "/* \u2500\u2500\u2500 debug toggle (mobile) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#debug-toggle {\n    position: fixed;\n    top: 50%;\n    left: 50%;\n    transform: translate(-50%, -50%);\n    width: 60px;\n    height: 60px;\n    z-index: 198;\n    display: none;\n    border-radius: 50%;\n    opacity: 0;\n}\n/* \u2500\u2500\u2500 touch controls \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#touch-controls {\n    position: fixed;\n    bottom: 0;\n    left: 0;\n    right: 0;\n    z-index: 199;\n    display: none;\n    justify-content: space-between;\n    align-items: flex-end;\n    padding: 12px 16px;\n    padding-bottom: max(12px, env(safe-area-inset-bottom));\n    padding-left: max(16px, env(safe-area-inset-left));\n    padding-right: max(16px, env(safe-area-inset-right));\n    pointer-events: none;\n    will-change: transform;\n}\n#touch-pad-left {\n    display: flex;\n    flex-direction: column;\n    gap: 8px;\n    pointer-events: all;\n}\n#touch-top-row {\n    display: flex;\n    justify-content: space-between;\n    align-items: flex-end;\n}\n\n/* \u2500\u2500\u2500 pitch wheel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#touch-pitch-wheel {\n    width: 52px;\n    height: 96px;\n    border-radius: 10px;\n    border: 1px solid rgba(255, 102, 0, 0.28);\n    background: rgba(255, 102, 0, 0.04);\n    box-shadow: 0 0 16px rgba(255, 102, 0, 0.06), inset 0 0 20px rgba(0,0,0,0.3);\n    position: relative;\n    overflow: hidden;\n    touch-action: none;\n    cursor: ns-resize;\n}\n#touch-pitch-drum {\n    position: absolute;\n    top: -100%;\n    left: 0; right: 0;\n    height: 300%;\n    background: repeating-linear-gradient(\n        180deg,\n        transparent 0px,\n        transparent 7px,\n        rgba(255, 102, 0, 0.10) 7px,\n        rgba(255, 102, 0, 0.10) 9px\n    );\n    pointer-events: none;\n}\n#touch-pitch-indicator {\n    position: absolute;\n    left: 5px; right: 5px;\n    height: 18px;\n    border-radius: 5px;\n    background: rgba(255, 102, 0, 0.18);\n    border: 1px solid rgba(255, 102, 0, 0.45);\n    top: 50%;\n    transform: translateY(-50%);\n    pointer-events: none;\n}\n#touch-pitch-indicator.active {\n    background: rgba(255, 102, 0, 0.32);\n    border-color: rgba(255, 102, 0, 0.9);\n    box-shadow: 0 0 10px rgba(255, 102, 0, 0.3);\n}\n#touch-pitch-wheel.active-up { border-color: rgba(255, 102, 0, 0.8); }\n#touch-pitch-wheel.active-dn { border-color: rgba(255, 102, 0, 0.8); }\n.pitch-label {\n    position: absolute;\n    left: 50%;\n    transform: translateX(-50%);\n    font-size: 11px;\n    font-family: monospace;\n    color: rgba(255, 102, 0, 0.28);\n    pointer-events: none;\n    line-height: 1;\n}\n.pitch-up { top: 5px; }\n.pitch-dn { bottom: 5px; }\n\n/* \u2500\u2500\u2500 deliver toggle (Kippschalter) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#touch-deliver-toggle {\n    width: 52px;\n    height: 96px;\n    border-radius: 10px;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    cursor: pointer;\n    touch-action: none;\n    user-select: none;\n    -webkit-user-select: none;\n    background: transparent;\n    border: none;\n    box-shadow: none;\n}\n.toggle-housing {\n    width: 52px;\n    height: 96px;\n    border-radius: 10px;\n    background: transparent;\n    border: none;\n    box-shadow: none;\n    position: relative;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    perspective: 200px;\n    pointer-events: none;\n    transition: none;\n}\n.toggle-rocker {\n    width: 52px;\n    height: 96px;\n    border-radius: 10px;\n    background: linear-gradient(180deg,\n        rgba(255, 102, 0, 0.14) 0%,\n        rgba(0, 0, 0, 0.70) 25%,\n        rgba(0, 0, 0, 0.70) 75%,\n        rgba(255, 102, 0, 0.06) 100%\n    );\n    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.9);\n    border: none;\n    transform: rotateX(-22deg);\n    transform-origin: center bottom;\n    transition: transform 0.15s ease-out, background 0.2s, border-color 0.2s, box-shadow 0.2s;\n    pointer-events: none;\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: space-between;\n    padding: 6px 0;\n    box-sizing: border-box;\n}\n/* top pip = off indicator, bottom pip = on indicator */\n.toggle-rocker::before,\n.toggle-rocker::after {\n    content: '';\n    width: 8px;\n    height: 8px;\n    border-radius: 50%;\n    transition: background 0.2s, box-shadow 0.2s;\n}\n.toggle-rocker::before { background: rgba(255, 102, 0, 0.5); }\n.toggle-rocker::after  { background: rgba(255, 102, 0, 0.15); }\n\n#touch-deliver-toggle.on .toggle-housing {\n    box-shadow: none;\n}\n#touch-deliver-toggle.on .toggle-rocker {\n    transform: rotateX(22deg);\n    transform-origin: center top;\n    background: linear-gradient(180deg,\n        rgba(255, 102, 0, 0.06) 0%,\n        rgba(0, 0, 0, 0.60) 25%,\n        rgba(255, 102, 0, 0.30) 75%,\n        rgba(255, 102, 0, 0.55) 100%\n    );\n    box-shadow: 0 4px 20px rgba(255, 102, 0, 0.4), inset 0 2px 8px rgba(0, 0, 0, 0.9);\n}\n#touch-deliver-toggle.on .toggle-rocker::before { background: rgba(255, 102, 0, 0.15); }\n#touch-deliver-toggle.on .toggle-rocker::after  { background: #ff6600; box-shadow: 0 0 8px rgba(255, 102, 0, 1); }\n\n/* \u2500\u2500\u2500 joystick \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.joystick {\n    width: 130px;\n    height: 130px;\n    border-radius: 50%;\n    border: 1px solid rgba(255, 102, 0, 0.28);\n    background: rgba(255, 102, 0, 0.04);\n    box-shadow: 0 0 24px rgba(255, 102, 0, 0.07), inset 0 0 30px rgba(0,0,0,0.35);\n    position: relative;\n    touch-action: none;\n    pointer-events: all;\n    will-change: transform;\n    user-select: none;\n    -webkit-user-select: none;\n    -webkit-touch-callout: none;\n}\n.joystick-knob {\n    width: 52px;\n    height: 52px;\n    border-radius: 50%;\n    background: rgba(255, 102, 0, 0.14);\n    border: 1px solid rgba(255, 102, 0, 0.55);\n    box-shadow: 0 0 14px rgba(255, 102, 0, 0.22);\n    position: absolute;\n    top: 50%;\n    left: 50%;\n    transform: translate(-50%, -50%);\n    pointer-events: none;\n    transition: transform 0.12s ease-out;\n    will-change: transform;\n}\n.js-n, .js-s, .js-w, .js-e {\n    position: absolute;\n    color: rgba(255, 102, 0, 0.28);\n    font-size: 11px;\n    font-family: monospace;\n    font-weight: bold;\n    pointer-events: none;\n    line-height: 1;\n}\n.js-n { top: 7px;    left: 50%; transform: translateX(-50%); }\n.js-s { bottom: 7px; left: 50%; transform: translateX(-50%); }\n.js-w { left: 7px;   top: 50%;  transform: translateY(-50%); }\n.js-e { right: 7px;  top: 50%;  transform: translateY(-50%); }\n\n/* \u2500\u2500\u2500 generic touch button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.touch-btn {\n    background: rgba(255, 102, 0, 0.06);\n    border: 1px solid rgba(255, 102, 0, 0.25);\n    border-radius: 8px;\n    color: rgba(255, 102, 0, 0.5);\n    font-family: monospace;\n    font-size: 18px;\n    font-weight: bold;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    cursor: pointer;\n    touch-action: none;\n    user-select: none;\n    -webkit-user-select: none;\n    padding: 0;\n    margin: 0;\n    line-height: 1;\n    transition:\n        background 0.08s,\n        border-color 0.08s,\n        color 0.08s,\n        box-shadow 0.08s;\n    text-shadow: 0 0 8px rgba(255, 102, 0, 0.4);\n}\n.touch-btn.active {\n    background: rgba(255, 102, 0, 0.18);\n    border-color: rgba(255, 102, 0, 0.85);\n    color: #ff6600;\n    text-shadow:\n        0 0 12px #ff6600,\n        0 0 24px rgba(255, 102, 0, 0.5);\n    box-shadow:\n        0 0 16px rgba(255, 102, 0, 0.3),\n        inset 0 0 12px rgba(255, 102, 0, 0.08);\n}\n\n/* \u2500\u2500\u2500 PROFI safe-zone overlay (right stick, screen-relative mode) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n/* safe zone = |dx| < |dy|*0.4 \u2192 \xB121.8\xB0 from top and bottom */\n.js-safe-zone {\n    position: absolute;\n    inset: 0;\n    border-radius: 50%;\n    pointer-events: none;\n    opacity: 0;\n    transition: opacity 0.3s ease;\n    background: conic-gradient(\n        from 0deg at center,\n        rgba(255, 102, 0, 0.13)   0deg,\n        rgba(255, 102, 0, 0.13)  35deg,\n        transparent              35deg,\n        transparent             145deg,\n        rgba(255, 102, 0, 0.13) 145deg,\n        rgba(255, 102, 0, 0.13) 215deg,\n        transparent             215deg,\n        transparent             325deg,\n        rgba(255, 102, 0, 0.13) 325deg,\n        rgba(255, 102, 0, 0.13) 360deg\n    );\n}\n.joystick.profi .js-safe-zone {\n    opacity: 1;\n}\n\n/* \u2500\u2500 Tutorial highlight (touch devices only) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n@media (pointer: coarse) {\n    @keyframes tutorial-pulse {\n        0%, 100% { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.75), 0 0 10px 4px rgba(255, 255, 255, 0.35); }\n        50%       { box-shadow: 0 0 0 4px rgba(255, 255, 255, 1.0),  0 0 20px 10px rgba(255, 255, 255, 0.55); }\n    }\n\n    .tutorial-highlight {\n        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9), 0 0 16px 6px rgba(255, 255, 255, 0.45);\n        border-radius: inherit;\n        animation: tutorial-pulse 1.4s ease-in-out infinite;\n    }\n}\n";
  document.head.appendChild(__el17);

  // ../src/game/ui/touch-controls/touch-controls.ui.ts
  var _toggleEl = null;
  var mount13 = () => {
    if (document.getElementById("touch-controls")) return;
    const el2 = document.createElement("div");
    el2.id = "touch-controls";
    el2.innerHTML = `
        <div id="touch-pad-left">
            <div id="touch-top-row">
                <div id="touch-pitch-wheel" title="Winschen">
                    <div id="touch-pitch-drum"></div>
                    <div id="touch-pitch-indicator"></div>
                    <span class="pitch-label pitch-up">\u2191</span>
                    <span class="pitch-label pitch-dn">\u2193</span>
                </div>
                <div id="touch-deliver-toggle" class="touch-btn" data-key="KeyR" title="Absetz-Modus">
                    <div class="toggle-housing">
                        <div class="toggle-rocker"></div>
                    </div>
                </div>
            </div>
            <div class="joystick" id="joystick-left">
                <span class="js-n">W</span><span class="js-s">S</span>
                <span class="js-w">A</span><span class="js-e">D</span>
                <div class="joystick-knob"></div>
            </div>
        </div>
        <div class="joystick" id="joystick-right">
            <div class="js-safe-zone"></div>
            <span class="js-n">\u25B2</span><span class="js-s">\u25BC</span>
            <span class="js-w">\u25C0</span><span class="js-e">\u25B6</span>
            <div class="joystick-knob"></div>
        </div>`;
    document.body.appendChild(el2);
    _toggleEl = el2.querySelector("#touch-deliver-toggle");
  };

  // ../src/game/ui/mp-lobby/mp-lobby.css
  var __el18 = document.createElement("style");
  __el18.textContent = "/* \u2500\u2500\u2500 MP Lobby screen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n#mp-lobby-screen {\n    position: absolute;\n    top: 0; left: 0; width: 100%; height: 100%;\n    background: rgba(5, 5, 5, 0.95);\n    display: none;\n    flex-direction: column;\n    justify-content: center;\n    align-items: center;\n    z-index: 200;\n    cursor: default;\n    gap: 18px;\n    font-family: monospace;\n    color: #2a4a2a;\n}\n\n/* \u2500\u2500\u2500 reuse game title / subtitle classes from screens.css \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.mp-flow {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    gap: 14px;\n    width: 100%;\n    max-width: 480px;\n}\n\n.mp-label {\n    font-size: 11px;\n    letter-spacing: 4px;\n    color: #555;\n    text-align: center;\n}\n\n.mp-textarea {\n    width: 100%;\n    box-sizing: border-box;\n    height: 80px;\n    background: #050505;\n    border: 1px solid #2a3a2a;\n    color: #5f5;\n    font-family: monospace;\n    font-size: 10px;\n    letter-spacing: 1px;\n    padding: 8px;\n    resize: none;\n    outline: none;\n    word-break: break-all;\n}\n\n.mp-textarea:focus {\n    border-color: #5f5;\n}\n\n.mp-textarea[readonly] {\n    color: #3a8a3a;\n    cursor: default;\n}\n\n.mp-btn {\n    font-family: monospace;\n    font-size: 13px;\n    font-weight: bold;\n    letter-spacing: 5px;\n    color: #2a4a2a;\n    border: 1px solid #1a3a1a;\n    background: none;\n    cursor: pointer;\n    padding: 12px 32px;\n    transition: all 0.25s ease;\n    text-align: center;\n    min-width: 220px;\n}\n\n.mp-btn:hover {\n    color: #fff;\n    border-color: #ff6600;\n    text-shadow:\n        0 0 12px #ff6600,\n        0 0 30px rgba(255, 102, 0, 0.3);\n    box-shadow:\n        0 0 28px rgba(255, 102, 0, 0.2),\n        inset 0 0 28px rgba(255, 102, 0, 0.04);\n}\n\n.mp-btn:disabled {\n    opacity: 0.35;\n    cursor: default;\n    pointer-events: none;\n}\n\n.mp-btn-small {\n    font-size: 11px;\n    letter-spacing: 3px;\n    padding: 8px 20px;\n    min-width: auto;\n}\n\n.mp-status {\n    font-size: 12px;\n    letter-spacing: 3px;\n    color: #555;\n    min-height: 18px;\n    text-align: center;\n}\n\n.mp-status.ok    { color: #5f5; }\n.mp-status.error { color: #f44; }\n\n.mp-row {\n    display: flex;\n    gap: 10px;\n    align-items: center;\n}\n\n#mp-lobby-initial {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    gap: 12px;\n}\n\n/* \u2500\u2500\u2500 Heli select cards \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.mp-heli-cards {\n    display: flex;\n    gap: 10px;\n    justify-content: center;\n    flex-wrap: wrap;\n    width: 100%;\n}\n\n.mp-heli-card {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    gap: 4px;\n    padding: 12px 16px;\n    border: 1px solid #1a3a1a;\n    background: none;\n    cursor: pointer;\n    transition: all 0.2s ease;\n    min-width: 130px;\n    font-family: monospace;\n    color: #2a4a2a;\n}\n\n.mp-heli-card:hover {\n    border-color: #3a6a3a;\n    color: #5f5;\n}\n\n.mp-heli-card.selected {\n    border-color: #ff6600;\n    color: #fff;\n    box-shadow:\n        0 0 18px rgba(255, 102, 0, 0.25),\n        inset 0 0 12px rgba(255, 102, 0, 0.05);\n}\n\n.mp-heli-card-label {\n    font-size: 11px;\n    font-weight: bold;\n    letter-spacing: 2px;\n}\n\n.mp-heli-card-sub {\n    font-size: 9px;\n    letter-spacing: 1px;\n    color: inherit;\n    opacity: 0.7;\n}\n\n/* \u2500\u2500\u2500 Countdown display \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.mp-countdown {\n    font-size: 96px;\n    font-weight: bold;\n    font-family: monospace;\n    color: #ff6600;\n    letter-spacing: 4px;\n    text-shadow:\n        0 0 30px rgba(255, 102, 0, 0.6),\n        0 0 60px rgba(255, 102, 0, 0.3);\n    animation: mp-pulse 0.8s ease-out;\n}\n\n@keyframes mp-pulse {\n    0%   { transform: scale(1.4); opacity: 0.5; }\n    100% { transform: scale(1);   opacity: 1;   }\n}\n";
  document.head.appendChild(__el18);

  // ../src/game/multiplayer/rtc.ts
  var ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ];
  var waitForIce = (pc) => new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
  });
  var encode2 = (sdp) => btoa(JSON.stringify(sdp));
  var decode2 = (b64) => JSON.parse(atob(b64));
  var createRTCPeer = () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    let _isHost = false;
    let _connectCb = null;
    let _posCb = null;
    let _eventCb = null;
    const buildChannels = (posCh, eventCh) => {
      posCh.onmessage = (e) => {
        if (_posCb) _posCb(JSON.parse(e.data));
      };
      eventCh.onmessage = (e) => {
        if (_eventCb) _eventCb(JSON.parse(e.data));
      };
      return {
        sendPos: (snap) => {
          if (posCh.readyState === "open") posCh.send(JSON.stringify(snap));
        },
        sendEvent: (evt) => {
          if (eventCh.readyState === "open") eventCh.send(JSON.stringify(evt));
        },
        onPos: (cb) => {
          _posCb = cb;
        },
        onEvent: (cb) => {
          _eventCb = cb;
        }
      };
    };
    const waitBothOpen = (posCh, eventCh) => {
      let posOpen = false, evtOpen = false;
      const check = () => {
        if (posOpen && evtOpen && _connectCb) _connectCb(buildChannels(posCh, eventCh));
      };
      posCh.onopen = () => {
        posOpen = true;
        check();
      };
      eventCh.onopen = () => {
        evtOpen = true;
        check();
      };
    };
    return {
      get isHost() {
        return _isHost;
      },
      createOffer: async () => {
        _isHost = true;
        const posCh = pc.createDataChannel("pos", { ordered: false, maxRetransmits: 0 });
        const eventCh = pc.createDataChannel("events", { ordered: true });
        waitBothOpen(posCh, eventCh);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIce(pc);
        return encode2(pc.localDescription);
      },
      createAnswer: async (offerB64) => {
        _isHost = false;
        let _posCh = null;
        let _eventCh = null;
        let posReady = false, evtReady = false;
        const tryConnect = () => {
          if (posReady && evtReady && _posCh && _eventCh && _connectCb)
            _connectCb(buildChannels(_posCh, _eventCh));
        };
        pc.ondatachannel = (e) => {
          if (e.channel.label === "pos") {
            _posCh = e.channel;
            _posCh.onopen = () => {
              posReady = true;
              tryConnect();
            };
          } else if (e.channel.label === "events") {
            _eventCh = e.channel;
            _eventCh.onopen = () => {
              evtReady = true;
              tryConnect();
            };
          }
        };
        await pc.setRemoteDescription(decode2(offerB64));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitForIce(pc);
        return encode2(pc.localDescription);
      },
      applyAnswer: async (answerB64) => {
        await pc.setRemoteDescription(decode2(answerB64));
      },
      onConnect: (cb) => {
        _connectCb = cb;
      },
      close: () => {
        pc.close();
      }
    };
  };

  // ../src/game/ui/mp-lobby/mp-lobby.ui.ts
  var screen = () => document.getElementById("mp-lobby-screen");
  var el = (id) => document.getElementById(id);
  var setStatus = (id, txt, cls) => {
    const e = el(id);
    e.textContent = txt;
    e.className = "mp-status" + (cls ? ` ${cls}` : "");
  };
  var _showEl = (id) => {
    el(id).style.display = "flex";
  };
  var _hideEl = (id) => {
    el(id).style.display = "none";
  };
  var _initialBackBtn;
  var _hostBackBtn;
  var _guestBackBtn;
  var mount14 = () => {
    ensureEl("mp-lobby-screen").classList.add("ui-screen");
    const heliCards = HELI_TYPES.map((h) => `
            <div class="mp-heli-card" data-id="${h.id}">
                <div class="mp-heli-card-label">${h.selectLabel}</div>
                <div class="mp-heli-card-sub">${h.selectSub}</div>
            </div>`).join("");
    screen().innerHTML = `
        <div class="title">${I18N.MENU_MULTIPLAYER}</div>
        <div class="subtitle" style="margin-bottom:8px">${I18N.MP_SUBTITLE}</div>

        <div id="mp-lobby-initial">
            <button class="mp-btn" id="mp-create-btn">${I18N.MP_CREATE}</button>
            <button class="mp-btn" id="mp-join-btn">${I18N.MP_JOIN}</button>
        </div>

        <!-- Host flow -->
        <div id="mp-host-flow" class="mp-flow" style="display:none">
            <div class="mp-status" id="mp-host-status">${I18N.MP_GENERATING}</div>
            <div class="mp-label">${I18N.MP_STEP1_HOST}</div>
            <textarea id="mp-offer-txt" class="mp-textarea" readonly></textarea>
            <div class="mp-row">
                <button class="mp-btn mp-btn-small" id="mp-copy-offer-btn">${I18N.MP_COPY}</button>
            </div>
            <div class="mp-label">${I18N.MP_STEP2_HOST}</div>
            <textarea id="mp-answer-input" class="mp-textarea" placeholder="${I18N.MP_PASTE_HINT}"></textarea>
            <button class="mp-btn" id="mp-connect-btn" disabled>${I18N.MP_CONNECT}</button>
        </div>

        <!-- Guest flow -->
        <div id="mp-guest-flow" class="mp-flow" style="display:none">
            <div class="mp-label">${I18N.MP_STEP1_GUEST}</div>
            <textarea id="mp-offer-input" class="mp-textarea" placeholder="${I18N.MP_PASTE_HINT}"></textarea>
            <button class="mp-btn" id="mp-gen-answer-btn">${I18N.MP_GEN_ANSWER}</button>
            <div class="mp-status" id="mp-guest-status"></div>
            <div class="mp-label" id="mp-guest-step2-label" style="display:none">${I18N.MP_STEP2_GUEST}</div>
            <textarea id="mp-answer-txt" class="mp-textarea" readonly style="display:none"></textarea>
            <div class="mp-row" id="mp-guest-copy-row" style="display:none">
                <button class="mp-btn mp-btn-small" id="mp-copy-answer-btn">${I18N.MP_COPY}</button>
            </div>
        </div>

        <!-- Heli select + ready phase (shared by host and guest) -->
        <div id="mp-heli-flow" class="mp-flow" style="display:none">
            <div class="mp-status ok" id="mp-ready-peer-label"></div>
            <div class="mp-label">${I18N.HELI_SELECT_SUB}</div>
            <div class="mp-heli-cards" id="mp-heli-cards">${heliCards}</div>
            <div class="mp-status" id="mp-ready-status">${I18N.MP_READY_PROMPT}</div>
            <button class="mp-btn" id="mp-ready-btn" disabled>${I18N.MP_READY_BTN}</button>
            <div id="mp-countdown-display" class="mp-countdown" style="display:none"></div>
        </div>`;
    _initialBackBtn = createBackButton(() => {
    });
    el("mp-lobby-initial").appendChild(_initialBackBtn);
    _hostBackBtn = createBackButton(() => {
    });
    el("mp-host-flow").appendChild(_hostBackBtn);
    _guestBackBtn = createBackButton(() => {
    });
    el("mp-guest-flow").appendChild(_guestBackBtn);
  };
  var _showHeliAndReadyPhase = (channels, isHost, peerCallsign, cb) => {
    _hideEl("mp-host-flow");
    _hideEl("mp-guest-flow");
    _hideEl("mp-lobby-initial");
    _showEl("mp-heli-flow");
    el("mp-ready-peer-label").textContent = (peerCallsign || "WOLF") + " " + I18N.MP_CONNECTED;
    let selectedHeli = "";
    let localReady = false;
    let peerReady = false;
    const readyBtn = el("mp-ready-btn");
    const cards = screen().querySelectorAll(".mp-heli-card");
    cards.forEach((card) => {
      card.onclick = () => {
        if (localReady) return;
        cards.forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        selectedHeli = card.dataset.id;
        readyBtn.disabled = false;
      };
    });
    const runCountdown = () => {
      _hideEl("mp-ready-btn");
      screen().querySelectorAll(".mp-heli-card").forEach((c) => {
        c.style.pointerEvents = "none";
      });
      setStatus("mp-ready-status", "");
      const cdEl = el("mp-countdown-display");
      cdEl.style.display = "block";
      const steps = ["3", "2", "1", "LOS!"];
      let i = 0;
      const tick = () => {
        cdEl.textContent = steps[i++];
        if (i < steps.length) {
          setTimeout(tick, 1e3);
        } else {
          setTimeout(() => {
            hide4();
            cb.onConnected(isHost, peerCallsign, channels, selectedHeli);
          }, 700);
        }
      };
      tick();
    };
    const bothReady = () => {
      if (isHost) {
        channels.sendEvent({ t: "start" });
      }
      runCountdown();
    };
    channels.onEvent((evt) => {
      if (evt.t === "ready") {
        peerReady = true;
        if (localReady) bothReady();
      } else if (evt.t === "start") {
        runCountdown();
      }
    });
    readyBtn.onclick = () => {
      localReady = true;
      readyBtn.disabled = true;
      setStatus("mp-ready-status", I18N.MP_WAIT_READY);
      channels.sendEvent({ t: "ready" });
      if (peerReady) bothReady();
    };
  };
  var show11 = (cb) => {
    _showEl("mp-lobby-initial");
    _hideEl("mp-host-flow");
    _hideEl("mp-guest-flow");
    _hideEl("mp-heli-flow");
    screen().style.display = "flex";
    _initialBackBtn.onclick = cb.onBack;
    el("mp-create-btn").onclick = async () => {
      _hideEl("mp-lobby-initial");
      _showEl("mp-host-flow");
      setStatus("mp-host-status", I18N.MP_GENERATING);
      const peer = createRTCPeer();
      peer.onConnect((channels) => {
        channels.sendEvent({ t: "hello", callsign: _localCallsign });
        let peerCallsign = "";
        channels.onEvent((evt) => {
          if (evt.t === "hello") {
            peerCallsign = evt.callsign;
            _showHeliAndReadyPhase(channels, true, peerCallsign, cb);
          }
        });
      });
      try {
        const offerB64 = await peer.createOffer();
        el("mp-offer-txt").value = offerB64;
        setStatus("mp-host-status", I18N.MP_WAIT_ANSWER);
        el("mp-copy-offer-btn").onclick = () => {
          navigator.clipboard.writeText(offerB64).catch(() => {
          });
        };
        const answerInput = el("mp-answer-input");
        const connectBtn = el("mp-connect-btn");
        answerInput.oninput = () => {
          connectBtn.disabled = answerInput.value.trim().length < 10;
        };
        connectBtn.onclick = async () => {
          try {
            connectBtn.disabled = true;
            setStatus("mp-host-status", I18N.MP_CONNECTING);
            await peer.applyAnswer(answerInput.value.trim());
          } catch {
            setStatus("mp-host-status", I18N.MP_ERROR, "error");
            connectBtn.disabled = false;
          }
        };
      } catch {
        setStatus("mp-host-status", I18N.MP_ERROR, "error");
      }
      _hostBackBtn.onclick = () => {
        peer.close();
        _hideEl("mp-host-flow");
        _showEl("mp-lobby-initial");
      };
    };
    el("mp-join-btn").onclick = () => {
      _hideEl("mp-lobby-initial");
      _showEl("mp-guest-flow");
      const peer = createRTCPeer();
      peer.onConnect((channels) => {
        channels.sendEvent({ t: "hello", callsign: _localCallsign });
        let peerCallsign = "";
        channels.onEvent((evt) => {
          if (evt.t === "hello") {
            peerCallsign = evt.callsign;
            _showHeliAndReadyPhase(channels, false, peerCallsign, cb);
          }
        });
      });
      el("mp-gen-answer-btn").onclick = async () => {
        const offerTxt = el("mp-offer-input").value.trim();
        if (!offerTxt) return;
        setStatus("mp-guest-status", I18N.MP_GENERATING);
        el("mp-gen-answer-btn").disabled = true;
        try {
          const answerB64 = await peer.createAnswer(offerTxt);
          el("mp-answer-txt").value = answerB64;
          el("mp-answer-txt").style.display = "block";
          el("mp-guest-step2-label").style.display = "block";
          el("mp-guest-copy-row").style.display = "flex";
          setStatus("mp-guest-status", I18N.MP_WAIT_CONNECT);
          el("mp-copy-answer-btn").onclick = () => {
            navigator.clipboard.writeText(answerB64).catch(() => {
            });
          };
        } catch {
          setStatus("mp-guest-status", I18N.MP_ERROR, "error");
          el("mp-gen-answer-btn").disabled = false;
        }
      };
      _guestBackBtn.onclick = () => {
        peer.close();
        _hideEl("mp-guest-flow");
        _showEl("mp-lobby-initial");
      };
    };
  };
  var hide4 = () => {
    screen().style.display = "none";
  };
  var _localCallsign = "";

  // ../src/game/ui/ui-component-preview.ts
  var _stubLevel = (headline, briefing, overrides = {}) => ({
    headline,
    briefing,
    gridSize: 100,
    terrain: "0x2710",
    foliage: [],
    objects: [],
    payloads: [],
    objectives: [],
    spawnObject: "pad",
    rain: false,
    night: false,
    windDir: 0,
    windStr: 0,
    windVar: false,
    ...overrides
  });
  var STUB_CAMPAIGN = {
    type: "ZEEWOLF_CAMPAIGN",
    campaignTitle: { de: "OPERATION ZEEWOLF", en: "OPERATION ZEEWOLF" },
    campaignSublines: [
      { de: "Sichere den Archipel.", en: "Secure the archipelago." },
      { de: "Viel Gl\xFCck, Pilot.", en: "Good luck, pilot." }
    ],
    music: { briefing: "", ingame: "" },
    levels: [
      _stubLevel(
        { de: "Phase 1 \u2014 Erster Kontakt", en: "Phase 1 \u2014 First Contact" },
        {
          de: "Rette die verschollene Crew. Zwei Personen werden im Nordosten gemeldet.",
          en: "Rescue the missing crew. Two persons reported north-east."
        },
        { objects: [{ type: "carrier", x: 20, y: 20 }], objectives: [{ type: "rescue_all" }] }
      ),
      _stubLevel(
        { de: "Phase 2 \u2014 Sturmfront", en: "Phase 2 \u2014 Storm Front" },
        { de: "Schlechte Sicht. St\xFCrme ziehen auf.", en: "Poor visibility. Storms approaching." },
        { rain: true, objectives: [{ type: "rescue_all" }] }
      ),
      _stubLevel(
        { de: "Phase 3 \u2014 Nachtflug", en: "Phase 3 \u2014 Night Flight" },
        { de: "Nur Instrumente. Keine Sterne.", en: "Instruments only. No stars." },
        { night: true, objectives: [{ type: "rescue_all" }] }
      )
    ]
  };
  var STUB_FREE_FLIGHT = {
    type: "free-flight",
    campaignTitle: { de: "FREIER FLUG", en: "FREE FLIGHT" },
    campaignSublines: [{ de: "Keine Vorgaben.", en: "No objectives." }],
    levels: [_stubLevel({ de: "Freier Flug", en: "Free Flight" }, { de: "", en: "" })]
  };
  var session = loadSession();
  var _dummyCanvas = document.createElement("canvas");
  _dummyCanvas.width = 2;
  _dummyCanvas.height = 2;
  var _dummyCtx = _dummyCanvas.getContext("2d");
  var _dummyIso = (wx, wy, wz, camX, camY) => iso(wx, wy, wz, camX, camY, { canvas: _dummyCanvas, tileW, tileH, stepH });
  var _stubSceneRenderer = { add: () => {
  }, flush: () => {
  }, debugAltitude: false };
  var { drawHeli: _previewDrawHeli } = createDrawObjects(_dummyCtx, _dummyIso, tileW, tileH, _stubSceneRenderer);
  init(_previewDrawHeli);
  var showNav = (id) => showScreenCrtEnter(id);
  var setupMainMenu = () => {
    mount({
      onSplashClick: () => showNav("main-menu"),
      onStart: () => showNav("campaign-select"),
      onSettings: () => showNav("settings-screen"),
      onCredits: () => showNav("credits-screen"),
      onLegal: () => show7()
    });
    showNav("main-menu");
  };
  var setupBriefing = () => {
    mount2();
    showScreen(null);
    show(
      {
        headline: { de: "PHASE 1 \u2014 ERSTER KONTAKT", en: "PHASE 1 \u2014 FIRST CONTACT" },
        sublines: [
          { de: "\u25B8 Rette 2 \xDCberlebende", en: "\u25B8 Rescue 2 survivors" },
          { de: "\u25B8 Lande auf dem Tr\xE4ger", en: "\u25B8 Land on the carrier" }
        ],
        briefing: {
          de: "Die K\xFCstenwache hat zwei \xDCberlebende im Nordosten gemeldet. Wetter zieht auf.",
          en: "Coast guard reported two survivors north-east. Weather closing in."
        },
        address: "SAR WOLF \xB7 MISSION 01"
      },
      () => {
      }
    );
  };
  var setupCampaignSelect = () => {
    mount3();
    show2({
      session,
      campaigns: [STUB_FREE_FLIGHT, STUB_CAMPAIGN, STUB_CAMPAIGN],
      onSelect: () => {
      },
      onBack: () => {
      }
    });
  };
  var setupMissionSelect = () => {
    mount4();
    show3({
      campaign: STUB_CAMPAIGN,
      campaignIndex: 1,
      session,
      onSelect: () => {
      },
      onBack: () => {
      }
    });
  };
  var setupHeliSelect = () => {
    mount5();
    show4({
      rankIndex: RANKS.indexOf(getRank(session)),
      onSelect: () => {
      },
      onBack: () => {
      }
    });
  };
  var setupSettings = () => {
    init2({
      getSession: () => session,
      saveSession: () => {
      },
      getRankMissions: () => 8,
      getControlMode: () => "screen",
      setControlMode: () => {
      },
      isTouchDevice: () => false,
      isMusicEnabled: () => false,
      setMusicEnabled: () => {
      },
      isSfxEnabled: () => false,
      setSfxEnabled: () => {
      },
      onBack: () => {
      }
    });
    mount7();
    show6();
  };
  var setupLegalScreen = () => {
    mount8(() => {
    });
    show7();
  };
  var setupCookieBanner = () => {
    mount9();
  };
  var setupLoadingScreen = () => {
    showScreen(null);
    const handle = show8("ZEEWOLF SAR \u2014 LADEN\u2026");
    handle.step("Terrain", 0.3);
    setTimeout(() => handle.step("Objekte", 0.6), 600);
    setTimeout(() => handle.step("Fertig", 1), 1200);
  };
  var setupPauseOverlay = () => {
    mount10({
      isMusicEnabled: () => false,
      setMusicEnabled: () => {
      },
      isSfxEnabled: () => false,
      setSfxEnabled: () => {
      },
      getControlMode: () => "screen",
      setControlMode: () => {
      },
      isTouchDevice: () => false,
      onPause: () => {
      },
      onResume: () => {
      },
      onAbort: () => {
      }
    });
    showScreen(null);
    show9();
  };
  var setupRankup = () => {
    mount6();
    showScreen(null);
    show5(RANKS[1], "atlas");
  };
  var setupWhatsNew = () => {
    mount11();
    showScreen(null);
    show10(() => {
    });
  };
  var setupCreditsScreen = () => {
    mount12(() => {
    });
    showNav("credits-screen");
  };
  var setupTouchControls = () => {
    mount13();
  };
  var setupMpLobby = () => {
    mount14();
    showScreen(null);
    show11({
      onConnected: () => {
      },
      onBack: () => {
      }
    });
  };
  var setupUnavailable = (name) => {
    document.body.style.cssText = "display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0a;";
    const el2 = document.createElement("div");
    el2.style.cssText = "font-family:monospace;font-size:13px;color:#555;text-align:center;";
    el2.textContent = `Kein Preview f\xFCr: ${name}`;
    document.body.appendChild(el2);
  };
  var component = window.__PREVIEW_COMPONENT;
  switch (component) {
    case "main-menu":
      setupMainMenu();
      break;
    case "briefing":
      setupBriefing();
      break;
    case "campaign-select":
      setupCampaignSelect();
      break;
    case "mission-select":
      setupMissionSelect();
      break;
    case "heli-select":
      setupHeliSelect();
      break;
    case "settings":
      setupSettings();
      break;
    case "legal-screen":
      setupLegalScreen();
      break;
    case "cookie-banner":
      setupCookieBanner();
      break;
    case "loading-screen":
      setupLoadingScreen();
      break;
    case "pause-overlay":
      setupPauseOverlay();
      break;
    case "rankup":
      setupRankup();
      break;
    case "whats-new":
      setupWhatsNew();
      break;
    case "credits-screen":
      setupCreditsScreen();
      break;
    case "touch-controls":
      setupTouchControls();
      break;
    case "mp-lobby":
      setupMpLobby();
      break;
    default:
      setupUnavailable(component);
      break;
  }
})();
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
//# sourceMappingURL=ui-preview.js.map
