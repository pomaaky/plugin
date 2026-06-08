(function () {
  function CSInterface() {}

  CSInterface.prototype.evalScript = function (script, callback) {
    if (window.__adobe_cep__ && typeof window.__adobe_cep__.evalScript === 'function') {
      window.__adobe_cep__.evalScript(script, callback || function () {});
      return;
    }
    console.warn('CEP runtime non disponibile. Script:', script);
    if (callback) callback('CEP runtime non disponibile');
  };

  CSInterface.prototype.getSystemPath = function () {
    return '';
  };

  window.CSInterface = CSInterface;
})();
