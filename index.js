// ==UserScript==
// @name        CVS stub
// @namespace   cvs.xhr.interceptor
// @description XHR stub creator
// @include     https://*
// @version     1
// @grant       none
// @require     https://stuk.github.io/jszip/vendor/FileSaver.js
// @require     https://unpkg.com/jszip@latest/dist/jszip.js
// @run-at      document-start
// ==/UserScript==
'use strict';
var COMPLETED_READY_STATE = 4;
var RealXHRSend = XMLHttpRequest.prototype.send;
var requestCallbacks = [];
var responseCallbacks = [];
var wired = false;

function arrayRemove(array, item) {
    var index = array.indexOf(item);
    if (index > -1) {
        array.splice(index, 1);
    } else {
        throw new Error('Could not remove ' + item + ' from array');
    }
}

function fireCallbacks(callbacks, xhr) {
    for (var i = 0; i < callbacks.length; i++) {
        callbacks[i](xhr);
    }
}
var addRequestCallback = function(callback) {
    requestCallbacks.push(callback);
};
var removeRequestCallback = function(callback) {
    arrayRemove(requestCallbacks, callback);
};
var addResponseCallback = function(callback) {
    responseCallbacks.push(callback);
};
var removeResponseCallback = function(callback) {
    arrayRemove(responseCallbacks, callback);
};

function fireResponseCallbacksIfCompleted(xhr) {
    if (xhr.readyState === COMPLETED_READY_STATE) {
        fireCallbacks(responseCallbacks, xhr);
    }
}

function proxifyOnReadyStateChange(xhr) {
    var realOnReadyStateChange = xhr.onreadystatechange;
    if (realOnReadyStateChange) {
        xhr.onreadystatechange = function() {
            fireResponseCallbacksIfCompleted(xhr);
            realOnReadyStateChange();
        };
    }
}
var isWired = function() {
    return wired;
}
var wire = function() {
    if (wired) throw new Error('Ajax interceptor already wired');
    // Override send method of all XHR requests
    XMLHttpRequest.prototype.send = function() {
        // Fire request callbacks before sending the request
        fireCallbacks(requestCallbacks, this);
        // Wire response callbacks
        if (this.addEventListener) {
            var self = this;
            this.addEventListener('readystatechange', function() {
                fireResponseCallbacksIfCompleted(self);
            }, false);
        } else {
            proxifyOnReadyStateChange(this);
        }
        RealXHRSend.apply(this, arguments);
    };
    wired = true;
};
var unwire = function() {
    if (!wired) throw new Error('Ajax interceptor not currently wired');
    XMLHttpRequest.prototype.send = RealXHRSend;
    wired = false;
};
var zip = new JSZip();
wire();
addResponseCallback(function(xhr) {
    if (!xhr.resource.url.match(/(\.js$|.html$)/g)) {
        var requestName = xhr.resource.url.split('?')[0].split('/').slice(-1)[0] + '.json';
        console.debug('request', requestName);
        console.debug('response', xhr.response);
        zip.file(requestName, xhr.response);
    }
});
unsafeWindow.downloadStubZip = function() {
    zip.generateAsync({
        type: 'blob'
    }).then(function(content) {
        // see FileSaver.js
        var timeStamp = (new Date()).toISOString().slice(0, 10);
        saveAs(content, 'stubResponses' + timeStamp + '.zip');
    });
}
