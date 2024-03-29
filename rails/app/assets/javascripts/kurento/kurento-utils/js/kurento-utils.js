!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.kurentoUtils=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
 * (C) Copyright 2014 Kurento (http://kurento.org/)
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the GNU Lesser General Public License
 * (LGPL) version 2.1 which accompanies this distribution, and is available at
 * http://www.gnu.org/licenses/lgpl-2.1.html
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 */

var freeice = require('freeice');

/**
 * @description Default handler for error callbacks. The error messaged passed
 *              as argument is showed in a console, a div layer which should be
 *              previously created.
 *
 * @function defaultOnerror
 *
 * @param error -
 *            {String} Error message
 */
function defaultOnerror(error) {
	if (error)
		console.error(error);
}

function noop() {
};

/**
 * @classdesc Wrapper object of an RTCPeerConnection. This object is aimed to
 *            simplify the development of WebRTC-based applications.
 *
 * @constructor module:kurentoUtils.WebRtcPeer
 *
 * @param mode -
 *            {String} Mode in which the PeerConnection will be configured.
 *            Valid values are: 'recv', 'send', and 'sendRecv'
 * @param localVideo -
 *            {Object} Video tag for the local stream
 * @param remoteVideo -
 *            {Object} Video tag for the remote stream
 * @param onsdpoffer -
 *            {Function} Callback executed when a SDP offer has been generated
 * @param onerror -
 *            {Function} Callback executed when an error happens generating an
 *            SDP offer
 * @param videoStream -
 *            {Object} MediaStream to be used as primary source (typically video
 *            and audio, or only video if combined with audioStream) for
 *            localVideo and to be added as stream to the RTCPeerConnection
 * @param audioStream -
 *            {Object} MediaStream to be used as second source (typically for
 *            audio) for localVideo and to be added as stream to the
 *            RTCPeerConnection
 */
function WebRtcPeer(mode, localVideo, remoteVideo, onsdpoffer, onerror,
		videoStream, audioStream) {

	Object.defineProperty(this, 'pc', {
		writable : true
	});

	this.localVideo = localVideo;
	this.remoteVideo = remoteVideo;
	this.onerror = onerror || defaultOnerror;
	this.stream = videoStream;
	this.audioStream = audioStream;
	this.mode = mode;
	this.onsdpoffer = onsdpoffer || noop;
}

/**
 * @description This method creates the RTCPeerConnection object taking into
 *              account the properties received in the constructor. It starts
 *              the SDP negotiation process: generates the SDP offer and invokes
 *              the onsdpoffer callback. This callback is expected to send the
 *              SDP offer, in order to obtain an SDP answer from another peer.
 *
 * @function module:kurentoUtils.WebRtcPeer.prototype.start
 *
 */
WebRtcPeer.prototype.start = function(server, options) {

	var self = this;

	server  = server  || this.server;
	options = options || this.seoptionsrver;

	if (!this.pc) {
		this.pc = new RTCPeerConnection(server, options);
	}

	var pc = this.pc;

	if (this.stream && this.localVideo) {
		this.localVideo.src = URL.createObjectURL(this.stream);
		this.localVideo.muted = true;
	}

	if (this.stream) {
		pc.addStream(this.stream);
	}

	if (this.audioStream) {
		pc.addStream(this.audioStream);
	}

	this.constraints = {
		mandatory : {
			OfferToReceiveAudio : (this.remoteVideo !== undefined),
			OfferToReceiveVideo : (this.remoteVideo !== undefined)
		}
	};

	pc.createOffer(function(offer) {
		console.log('Created SDP offer');
		pc.setLocalDescription(offer, function() {
			console.log('Local description set');
		}, self.onerror);

	}, this.onerror, this.constraints);

	var ended = false;
	pc.onicecandidate = function(e) {
		// candidate exists in e.candidate
		if (e.candidate) {
			ended = false;
			return;
		}

		if (ended) {
			return;
		}

		var offerSdp = pc.localDescription.sdp;
		console.log('ICE negotiation completed');

		self.onsdpoffer(offerSdp, self);
		// self.emit('sdpoffer', offerSdp);

		ended = true;
	};
}

/**
 * @description This method frees the resources used by WebRtcPeer.
 *
 * @function module:kurentoUtils.WebRtcPeer.prototype.dispose
 */
WebRtcPeer.prototype.dispose = function() {
	console.log('Disposing WebRtcPeer');

	// FIXME This is not yet implemented in firefox
	// if (this.stream) this.pc.removeStream(this.stream);

	// For old browsers, PeerConnection.close() is NOT idempotent and raise
	// error. We check its signaling state and don't close it if it's already
	// closed
	if (this.pc && this.pc.signalingState != 'closed')
		this.pc.close();

	if (this.localVideo)
		this.localVideo.src = '';
	if (this.remoteVideo)
		this.remoteVideo.src = '';

	if (this.stream) {
		this.stream.getAudioTracks().forEach(function(track) {
			track.stop && track.stop()
		})
		this.stream.getVideoTracks().forEach(function(track) {
			track.stop && track.stop()
		})
	}
};

/**
 * @description Default user media constraints considered when invoking the
 *              getUserMedia function. These values are: maxWidth=640,
 *              maxFrameRate=15, minFrameRate=15.
 *
 * @alias module:kurentoUtils.WebRtcPeer.prototype.userMediaConstraints
 */
WebRtcPeer.prototype.userMediaConstraints = {
	audio : true,
	video : {
		mandatory : {
			maxWidth : 640,
			maxFrameRate : 15,
			minFrameRate : 15
		}
	}
};

/**
 * @description Callback function invoked when and SDP answer is received.
 *              Developers are expected to invoke this function in order to
 *              complete the SDP negotiation.
 *
 * @function module:kurentoUtils.WebRtcPeer.prototype.processSdpAnswer
 *
 * @param sdpAnswer -
 *            Description of sdpAnswer
 * @param successCallback -
 *            Called when the remoteDescription and the remoteVideo.src have
 *            been set successfully.
 */
WebRtcPeer.prototype.processSdpAnswer = function(sdpAnswer, successCallback) {
	var answer = new RTCSessionDescription({
		type : 'answer',
		sdp : sdpAnswer,
	});

	console.log('SDP answer received, setting remote description');
	var self = this;
	self.pc.setRemoteDescription(answer, function() {
		if (self.remoteVideo) {
			var stream = self.pc.getRemoteStreams()[0];
			self.remoteVideo.src = URL.createObjectURL(stream);
		}
		if (successCallback) {
			successCallback();
		}
	}, this.onerror);
}

/**
 * @description Default ICE server (stun:stun.l.google.com:19302).
 *
 * @alias module:kurentoUtils.WebRtcPeer.prototype.server
 */
WebRtcPeer.prototype.server = {
	iceServers : freeice()
};

/**
 * @description Default options (DtlsSrtpKeyAgreement=true) for
 *              RTCPeerConnection.
 *
 * @alias module:kurentoUtils.WebRtcPeer.prototype.options
 */
WebRtcPeer.prototype.options = {
	optional : [ {
		DtlsSrtpKeyAgreement : true
	} ]
};

/**
 * @description This method creates the WebRtcPeer object and obtain userMedia
 *              if needed.
 *
 * @function module:kurentoUtils.WebRtcPeer.start
 *
 * @param mode -
 *            {String} Mode in which the PeerConnection will be configured.
 *            Valid values are: 'recv', 'send', and 'sendRecv'
 * @param localVideo -
 *            {Object} Video tag for the local stream
 * @param remoteVideo -
 *            {Object} Video tag for the remote stream
 * @param onSdp -
 *            {Function} Callback executed when a SDP offer has been generated
 * @param onerror -
 *            {Function} Callback executed when an error happens generating an
 *            SDP offer
 * @param mediaConstraints -
 *            {Object[]} Constraints used to create RTCPeerConnection
 * @param videoStream -
 *            {Object} MediaStream to be used as primary source (typically video
 *            and audio, or only video if combined with audioStream) for
 *            localVideo and to be added as stream to the RTCPeerConnection
 * @param videoStream -
 *            {Object} MediaStream to be used as primary source (typically video
 *            and audio, or only video if combined with audioStream) for
 *            localVideo and to be added as stream to the RTCPeerConnection
 * @param audioStream -
 *            {Object} MediaStream to be used as second source (typically for
 *            audio) for localVideo and to be added as stream to the
 *            RTCPeerConnection
 *
 * @return {module:kurentoUtils.WebRtcPeer}
 */
WebRtcPeer.start = function(mode, localVideo, remoteVideo, onSdp, onerror,
		mediaConstraints, videoStream, audioStream, server, options) {
	var wp = new WebRtcPeer(mode, localVideo, remoteVideo, onSdp, onerror,
			videoStream, audioStream);

	if (wp.mode !== 'recv' && !wp.stream) {
		var constraints = mediaConstraints ? mediaConstraints
				: wp.userMediaConstraints;

		getUserMedia(constraints, function(userStream) {
			wp.stream = userStream;
			wp.start(server, options);
		}, wp.onerror);
	} else {
		wp.start(server, options);
	}

	return wp;
};

/**
 * @description This methods creates a WebRtcPeer to receive video.
 *
 * @function module:kurentoUtils.WebRtcPeer.startRecvOnly
 *
 * @param remoteVideo -
 *            {Object} Video tag for the remote stream
 * @param onSdp -
 *            {Function} Callback executed when a SDP offer has been generated
 * @param onerror -
 *            {Function} Callback executed when an error happens generating an
 *            SDP offer
 * @param mediaConstraints -
 *            {Object[]} Constraints used to create RTCPeerConnection
 *
 * @return {module:kurentoUtils.WebRtcPeer}
 */
WebRtcPeer.startRecvOnly = function(remoteVideo, onSdp, onError,
		mediaConstraints, server, options) {
	return WebRtcPeer.start('recv', null, remoteVideo, onSdp, onError,
			mediaConstraints, server, options);
};

/**
 * @description This methods creates a WebRtcPeer to send video.
 *
 * @function module:kurentoUtils.WebRtcPeer.startSendOnly
 *
 * @param localVideo -
 *            {Object} Video tag for the local stream
 * @param onSdp -
 *            {Function} Callback executed when a SDP offer has been generated
 * @param onerror -
 *            {Function} Callback executed when an error happens generating an
 *            SDP offer
 * @param mediaConstraints -
 *            {Object[]} Constraints used to create RTCPeerConnection
 *
 * @return {module:kurentoUtils.WebRtcPeer}
 */
WebRtcPeer.startSendOnly = function(localVideo, onSdp, onError,
		mediaConstraints, server, options) {
	console.log("Test: " + mediaConstraints.video.mandatory.maxWidth)
	return WebRtcPeer.start('send', localVideo, null, onSdp, onError,
			mediaConstraints, server, options);
};

/**
 * @description This methods creates a WebRtcPeer to send and receive video.
 *
 * @function module:kurentoUtils.WebRtcPeer.startSendRecv
 *
 * @param localVideo -
 *            {Object} Video tag for the local stream
 * @param remoteVideo -
 *            {Object} Video tag for the remote stream
 * @param onSdp -
 *            {Function} Callback executed when a SDP offer has been generated
 * @param onerror -
 *            {Function} Callback executed when an error happens generating an
 *            SDP offer
 * @param mediaConstraints -
 *            {Object[]} Constraints used to create RTCPeerConnection
 *
 * @return {module:kurentoUtils.WebRtcPeer}
 */
WebRtcPeer.startSendRecv = function(localVideo, remoteVideo, onSdp, onError,
		mediaConstraints, server, options) {
	return WebRtcPeer.start('sendRecv', localVideo, remoteVideo, onSdp,
			onError, mediaConstraints, server, options);
};

module.exports = WebRtcPeer;

},{"freeice":3}],2:[function(require,module,exports){
/*
 * (C) Copyright 2014 Kurento (http://kurento.org/)
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the GNU Lesser General Public License
 * (LGPL) version 2.1 which accompanies this distribution, and is available at
 * http://www.gnu.org/licenses/lgpl-2.1.html
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 */

/**
 * This module contains a set of reusable components that have been found useful
 * during the development of the WebRTC applications with Kurento.
 * 
 * @module kurentoUtils
 * 
 * @copyright 2014 Kurento (http://kurento.org/)
 * @license LGPL
 */

var WebRtcPeer = require('./WebRtcPeer');

exports.WebRtcPeer = WebRtcPeer;

},{"./WebRtcPeer":1}],3:[function(require,module,exports){
/* jshint node: true */
'use strict';

var normalice = require('normalice');

/**
  # freeice

  The `freeice` module is a simple way of getting random STUN or TURN server
  for your WebRTC application.  The list of servers (just STUN at this stage)
  were sourced from this [gist](https://gist.github.com/zziuni/3741933).

  ## Example Use

  The following demonstrates how you can use `freeice` with
  [rtc-quickconnect](https://github.com/rtc-io/rtc-quickconnect):

  <<< examples/quickconnect.js

  As the `freeice` module generates ice servers in a list compliant with the
  WebRTC spec you will be able to use it with raw `RTCPeerConnection`
  constructors and other WebRTC libraries.

  ## Hey, don't use my STUN/TURN server!

  If for some reason your free STUN or TURN server ends up in the
  list of servers ([stun](https://github.com/DamonOehlman/freeice/blob/master/stun.json) or
  [turn](https://github.com/DamonOehlman/freeice/blob/master/turn.json))
  that is used in this module, you can feel
  free to open an issue on this repository and those servers will be removed
  within 24 hours (or sooner).  This is the quickest and probably the most
  polite way to have something removed (and provides us some visibility
  if someone opens a pull request requesting that a server is added).

  ## Please add my server!

  If you have a server that you wish to add to the list, that's awesome! I'm
  sure I speak on behalf of a whole pile of WebRTC developers who say thanks.
  To get it into the list, feel free to either open a pull request or if you
  find that process a bit daunting then just create an issue requesting
  the addition of the server (make sure you provide all the details, and if
  you have a Terms of Service then including that in the PR/issue would be
  awesome).

  ## I know of a free server, can I add it?

  Sure, if you do your homework and make sure it is ok to use (I'm currently
  in the process of reviewing the terms of those STUN servers included from
  the original list).  If it's ok to go, then please see the previous entry
  for how to add it.

  ## Current List of Servers

  * current as at the time of last `README.md` file generation

  ### STUN

  <<< stun.json

  ### TURN

  <<< turn.json

**/

var freeice = module.exports = function(opts) {
  // if a list of servers has been provided, then use it instead of defaults
  var servers = {
    stun: (opts || {}).stun || require('./stun.json'),
    turn: (opts || {}).turn || require('./turn.json')
  };

  var stunCount = (opts || {}).stunCount || 2;
  var turnCount = (opts || {}).turnCount || 0;
  var selected;

  function getServers(type, count) {
    var out = [];
    var input = [].concat(servers[type]);
    var idx;

    while (input.length && out.length < count) {
      idx = (Math.random() * input.length) | 0;
      out = out.concat(input.splice(idx, 1));
    }

    return out.map(function(url) {
      return normalice(type + ':' + url);
    });
  }

  // add stun servers
  selected = [].concat(getServers('stun', stunCount));

  if (turnCount) {
    selected = selected.concat(getServers('turn', turnCount));
  }

  return selected;
};

},{"./stun.json":5,"./turn.json":6,"normalice":4}],4:[function(require,module,exports){
/**
  # normalice

  Normalize an ice server configuration object (or plain old string) into a format
  that is usable in all browsers supporting WebRTC.  Primarily this module is designed
  to help with the transition of the `url` attribute of the configuration object to
  the `urls` attribute.

  ## Example Usage

  <<< examples/simple.js

**/

var protocols = [
  'stun:',
  'turn:'
];

module.exports = function(input) {
  var url = (input || {}).url || input;
  var protocol;
  var parts;
  var output = {};

  // if we don't have a string url, then allow the input to passthrough
  if (typeof url != 'string' && (! (url instanceof String))) {
    return input;
  }

  // trim the url string, and convert to an array
  url = url.trim();

  // if the protocol is not known, then passthrough
  protocol = protocols[protocols.indexOf(url.slice(0, 5))];
  if (! protocol) {
    return input;
  }

  // now let's attack the remaining url parts
  url = url.slice(5);
  parts = url.split('@');

  output.username = input.username;
  output.credential = input.credential;
  // if we have an authentication part, then set the credentials
  if (parts.length > 1) {
    url = parts[1];
    parts = parts[0].split(':');

    // add the output credential and username
    output.username = parts[0];
    output.credential = (input || {}).credential || parts[1] || '';
  }

  output.url = protocol + url;
  output.urls = [ output.url ];

  return output;
};

},{}],5:[function(require,module,exports){
module.exports=[
  "stun.l.google.com:19302",
  "stun1.l.google.com:19302",
  "stun2.l.google.com:19302",
  "stun3.l.google.com:19302",
  "stun4.l.google.com:19302",
  "stun.ekiga.net",
  "stun.ideasip.com",
  "stun.rixtelecom.se",
  "stun.schlund.de",
  "stun.stunprotocol.org:3478",
  "stun.voiparound.com",
  "stun.voipbuster.com",
  "stun.voipstunt.com",
  "stun.voxgratia.org",
  "stun.services.mozilla.com"
]

},{}],6:[function(require,module,exports){
module.exports=[]

},{}]},{},[2])(2)
});