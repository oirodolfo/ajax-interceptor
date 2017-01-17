// ==UserScript==
// @name        stub saver
// @namespace   cvs.xhr.interceptor
// @description XHR stub creator
// @include     https://*
// @version     1
// @grant       none
// @require     https://stuk.github.io/jszip/vendor/FileSaver.js
// @require     https://unpkg.com/jszip@latest/dist/jszip.js
// @require     https://unpkg.com/lokijs@latest/build/lokijs.min.js
// @require     https://unpkg.com/lokijs@latest/build/loki-indexed-adapter.min.js
// @run-at      document-start
// ==/UserScript==

/* FLICKED IT FROM A GENIUS. MUHUHAHAHAHAHA */
/* SOURCE :: https://github.com/slorber/ajax-interceptor*/
'use strict';
var COMPLETED_READY_STATE = 4;
var RealXHRSend = XMLHttpRequest.prototype.send;
var requestCallbacks = [];
var responseCallbacks = [];
var wired = false;
function arrayRemove(array, item) {
	var index = array.indexOf(item);
	if (index > - 1) {
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
var addRequestCallback = function (callback) {
	requestCallbacks.push(callback);
};
var removeRequestCallback = function (callback) {
	arrayRemove(requestCallbacks, callback);
};
var addResponseCallback = function (callback) {
	responseCallbacks.push(callback);
};
var removeResponseCallback = function (callback) {
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
		xhr.onreadystatechange = function () {
			fireResponseCallbacksIfCompleted(xhr);
			realOnReadyStateChange();
		};
	}
}
var isWired = function () {
	return wired;
}
var wire = function () {
	if (wired) throw new Error('Ajax interceptor already wired');
	// Override send method of all XHR requests
	XMLHttpRequest.prototype.send = function () {
		this.sentBody = arguments;
		// Fire request callbacks before sending the request
		fireCallbacks(requestCallbacks, this);
		// Wire response callbacks
		if (this.addEventListener) {
			var self = this;
			this.addEventListener('readystatechange', function () {
				fireResponseCallbacksIfCompleted(self);
			}, false);
		} else {
			proxifyOnReadyStateChange(this);
		}
		RealXHRSend.apply(this, arguments);
	};
	wired = true;
};
var unwire = function () {
	if (!wired) throw new Error('Ajax interceptor not currently wired');
	XMLHttpRequest.prototype.send = RealXHRSend;
	wired = false;
};

var zip = new JSZip();

/* DB STUBBING (AKA DUBSTEPPING) */

var db = new loki('cvsStub.db', {
	autosave: true,
	autosaveInterval: 1000, // 1 seconds
});

var items = db.addCollection('responses');

/* Now I begin using XMLHttpRequest interceptor */

wire();

var responses = {};

addRequestCallback(function (xhr) {
	if (!xhr.resource) return console.log('FAIL -', xhr);
	if (!xhr.resource.url.match(/(\.js$|.html$)/g)) {
		var splitURL = xhr.resource.url.split('?');
		var requestName = splitURL[0].split('/').slice(-1)[0];
		console.log(requestName, ' - ', xhr.send.arguments[0]);
		var response = items.findOne({ name: requestName, params: splitURL[1] ? splitURL[1] : '', requestBody: xhr.sentBody[0] });
		if (!response) {
			items.insert({
				name: requestName,
				params: splitURL[1] ? splitURL[1] : '',
				requestBody: xhr.sentBody[0],
				response: ''
			});
		}
	}
});

addResponseCallback(function (xhr) {
	if (!xhr.resource) return console.log('FAIL -', xhr);
	if (!xhr.resource.url.match(/(\.js$|.html$)/g)) {
		console.log(xhr);
		var splitURL = xhr.resource.url.split('?');
		var requestName = splitURL[0].split('/').slice(-1)[0];
		console.debug('Response : ', requestName);
		var response = items.findOne({ name: requestName, params: splitURL[1] ? splitURL[1] : '', requestBody: xhr.sentBody[0] });
		console.log(response, ' with ', xhr.sentBody[0]);
		response.response = xhr.response;
		items.update(response);
	}
});

// Download function
unsafeWindow.downloadStubZip = function () {
	// zip.generateAsync({
	// 	type: 'blob'
	// }).then(function (content) {
	// 	// see FileSaver.js
	// 	var timeStamp = (new Date()).toISOString().slice(0, 10);
	// 	saveAs(content, 'stubResponses' + timeStamp + '.zip');
	// });
	var timeStamp = (new Date()).toISOString().slice(0, 10);
	var data = items.data.map(function (item) {
		return {
			name: item.name,
			params: item.params,
			requestBody: item.requestBody,
			response: item.response
		}
	});
	// console.log(JSON.stringify(items));
	saveAs(new Blob([JSON.stringify(data)], { type: "application/json" }), 'stubResponses' + timeStamp + '.json');
}
