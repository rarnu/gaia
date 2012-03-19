/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

window.addEventListener('DOMContentLoaded', function scanWifiNetworks(evt) {
  var wifiManager = navigator.mozWifiManager;
  var _ = document.mozL10n.get;

  // globals
  var gStatus = document.querySelector('#status small');
  var gList = document.querySelector('#wifi-networks');

  // current state
  function updateState() {
    var currentNetwork = wifiManager.connectedNetwork;
    var enabledBox = document.querySelector('#wifi input[type=checkbox]');
    if (currentNetwork) {
      gStatus.textContent = _('connected', { ssid: currentNetwork.ssid });
      enabledBox.checked = true;
    }
    else if (wifiManager.enabled) {
      gStatus.textContent = _('offline');
      enabledBox.checked = true;
    }
    else {
      gStatus.textContent = _('disabled');
      enabledBox.checked = false;
    }
  }

  // toggle wifi on/off
  document.querySelector('#status input').onchange = function() {
    while (gList.hasChildNodes())
      gList.removeChild(gList.lastChild);

    var req;
    if (wifiManager.enabled) {
      req = wifiManager.setEnabled(false);
    }
    else {
      req = wifiManager.setEnabled(true);
      gList.appendChild(newScanItem());
      wifiScanNetworks();
    }
    req.onsuccess = updateState;
  }

  function newScanItem() {
    var a = document.createElement('a');
    a.textContent = _('scanning');

    var span = document.createElement('span');
    span.className = 'wifi-search';

    var label = document.createElement('label');
    label.appendChild(span);

    var li = document.createElement('li');
    li.appendChild(a);
    li.appendChild(label);

    return li;
  }

  function newListItem(network) {
    // ssid
    var span = document.createElement('span');
    span.textContent = network.ssid;

    // signal is between 0 and 100, level should be between 0 and 4
    var signal = document.createElement('span');
    var level = Math.min(Math.floor(network.signal / 20), 4);
    signal.className = 'wifi-signal' + level;
    var label = document.createElement('label');
    label.className = 'wifi';
    label.appendChild(signal);

    // supported authentication methods
    var small = document.createElement('small');
    var keys = network.capabilities;
    if (keys && keys.length) {
      small.textContent = _('securedBy', { capabilities: keys.join(', ') });
      var secure = document.createElement('span');
      secure.className = 'wifi-secure';
      label.appendChild(secure);
    }
    else {
      small.textContent = _('securityOpen');
    }

    // create list item
    var li = document.createElement('li');
    li.appendChild(span);
    li.appendChild(small);
    li.appendChild(label);

    // bind connection callback
    li.onclick = function() {
      showNetwork(network);
    }
    return li;
  }

  function wifiConnect(network) {
    var connection = wifiManager.associate(network);
    connection.onsuccess = function() {
      gStatus.textContent = _('connecting', { ssid: network.ssid });
    };
    connection.onerror = function() {
      gStatus.textContent = connection.error.name;
    };
  }

  function wifiDisconnect(network) {
    // not working yet
  }

  // mozWifiManager events / callbacks
  wifiManager.onassociate = function(event) {
    gStatus.textContent = _('associating');
  };

  wifiManager.onconnect = function(event) {
    gStatus.textContent = _('connected', { ssid: event.network.ssid });
    wifiScanNetworks(); // refresh the network list
  };

  wifiManager.ondisconnect = function(event) {
    gStatus.textContent = _('offline');
  };

  // scan wifi networks
  function wifiScanNetworks() {
    var req = wifiManager.getNetworks();

    req.onsuccess = function() {
      var networks = req.result;

      // sort networks: connected network first, then by signal strength
      var ssids = Object.getOwnPropertyNames(networks);
      ssids.sort(function(a, b) {
        return isConnected(networks[b]) ?  100 :
          networks[b].signal - networks[a].signal;
      });

      // create list
      while (gList.hasChildNodes())
        gList.removeChild(gList.lastChild);
      for (var i = 0; i < ssids.length; i++) {
        var li = newListItem(networks[ssids[i]]);
        gList.appendChild(li);
      }
    };

    req.onerror = function(error) {
      gStatus.textContent = 'error: ' + req.error.name;
    };

    updateState();
  }

  function isConnected(network) {
    // XXX the API should expose a 'connected' property on 'network',
    // and 'wifiManager.connectedNetwork' should be comparable to 'network'.
    // Until this is properly implemented, we just compare SSIDs to tell wether
    // the network is already connected or not.
    var currentNetwork = wifiManager.connectedNetwork;
    return currentNetwork && (currentNetwork.ssid == network.ssid);
  }

  function showNetwork(network) {
    if (isConnected(network)) {
      // online: show status + offer to disconnect
      wifiDialog('#wifi-status', network, wifiDisconnect);
    }
    else {
      // offline: offer to connect
      var key = network.capabilities[0];
      if (/WEP$/.test(key)) {
        wifiDialog('#wifi-wep', network, wifiConnect);
      }
      else if (/EAP$/.test(key)) {
        wifiDialog('#wifi-eap', network, wifiConnect);
      }
      else if (/PSK$/.test(key)) {
        wifiDialog('#wifi-psk', network, wifiConnect);
      }
      else {
        wifiConnect(network);
      }
    }
  }

  function wifiDialog(selector, network, callback) {
    var dialog = document.querySelector(selector);
    if (!dialog || !network)
      return null;

    // network info
    var ssid = dialog.querySelector('*[data-ssid]');
    if (ssid)
      ssid.textContent = network.ssid;

    var keys = network.capabilities;
    var security = dialog.querySelector('*[data-security]');
    if (security)
      security.textContent = (keys && keys.length) ?
        keys.join(', ') : _('securityNone');

    var signal = dialog.querySelector('*[data-signal]');
    if (signal) {
      var lvl = Math.min(Math.floor(network.signal / 20), 4);
      signal.textContent = _('signalLevel' + lvl);
    }

    // identity/password
    var identity = dialog.querySelector('input[name=identity]');
    if (identity)
      identity.value = network.identity || '';

    var password = dialog.querySelector('input[name=password]');
    if (password) {
      password.type = 'password';
      password.value = network.password || '';
    }

    var showPassword = dialog.querySelector('input[name=show-pwd]');
    if (showPassword) {
      showPassword.checked = false;
      showPassword.onchange = function() {
        password.type = this.checked ? 'text' : 'password';
      };
    }

    // hide dialog box
    function close() {
      document.body.classList.remove('dialog');
      dialog.classList.remove('active');
    }

    // OK|Cancel buttons
    var buttons = dialog.querySelectorAll('footer button');

    var okButton = buttons[0];
    okButton.onclick = function() {
      close();
      if (identity)
        network.identity = identity.value;
      // when we're on a known network, password == '*':
      // no further authentication required.
      if (password && password.value != '*') {
        var key = network.capabilities[0];
        var keyManagement = '';
        if (/WEP$/.test(key)) {
          keyManagement = 'WEP';
          network.wep = password.value;
        }
        else if (/PSK$/.test(key)) {
          keyManagement = 'WPA-PSK';
          network.psk = password.value;
        }
        else if (/EAP$/.test(key)) {
          keyManagement = 'WPA-EAP';
          network.password = password.value;
        }
        network.keyManagement = keyManagement;
      }
      return callback ? callback(network) : false;
    };

    var cancelButton = buttons[1];
    cancelButton.onclick = function() {
      close();
      return;
    };

    // show dialog box
    dialog.classList.add('active');
    document.body.classList.add('dialog');
    return dialog;
  }

  updateState();
  if (wifiManager.enabled) {
    gList.appendChild(newScanItem());
    wifiScanNetworks();
  }
});