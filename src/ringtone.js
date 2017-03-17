/*
 * Copyright 2014-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Amazon Software License (the "License"). You may not use
 * this file except in compliance with the License. A copy of the License is
 * located at
 *
 *    http://aws.amazon.com/asl/
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express
 * or implied. See the License for the specific language governing permissions
 * and limitations under the License.
 */
(function() {
   var global = this;
   var connect = global.connect || {};
   global.connect = connect;
   global.lily = connect;

   var RingtoneEngine = function(softphoneParams) {
      var self = this;

      this._prevContactId = null;

      connect.assertNotNull(softphoneParams, "softphoneParams");
      if (! softphoneParams.ringtoneUrl || softphoneParams.ringtoneUrl === "") {
         throw new Error("ringtoneUrl is required!");
      }

      if (global.Audio && typeof global.Promise !== "undefined") {
         this._playableAudioPromise = new Promise(function(resolve, reject) {
            self._audio = new Audio(softphoneParams.ringtoneUrl);
            self._audio.loop = true;
            self._audio.addEventListener("canplay", function(){
               self._audioPlayable = true;
               resolve(self._audio);
            });
         });

      } else {
         this._audio = null;
         connect.getLog().error("Unable to provide a ringtone.");
      }

      // TODO: this should triggers onIncoming instead of onConnecting
      // https://issues.amazon.com/issues/ConnectGatekeepers-974
      connect.contact(function(contact) {
         contact.onConnecting(function() {
            if (contact.getType() === connect.ContactType.VOICE &&
               contact.isSoftphoneCall() &&
               contact.isInbound()) {

               self._startRingtone();
               self._prevContactId = contact.getContactId();

               contact.onConnected(connect.hitch(self, self._stopRingtone));
               contact.onAccepted(connect.hitch(self, self._stopRingtone));
               contact.onEnded(connect.hitch(self, self._stopRingtone));
            }
         });
      });
   };

   RingtoneEngine.prototype._startRingtone = function() {
      if (this._audio) {
         this._audio.play();
      }
   };

   RingtoneEngine.prototype._stopRingtone = function() {
      if (this._audio) {
         this._audio.pause();
         this._audio.currentTime = 0;
      }
   };

   /**
    * Stop ringtone.
    */
   RingtoneEngine.prototype.stopRingtone = function() {
      this._stopRingtone();
   };

   /**
    * Change the audio device used to play ringtone.
    * If audio element is not fully initialized, the API will wait _audioPlayablePromise for 3 seconds and fail on timeout.
    * This API is supported only by browsers that implemented ES6 Promise and http://www.w3.org/TR/audio-output/
    * Return a Promise that indicates the result of changing output device.
    */
   RingtoneEngine.prototype.setOutputDevice = function(deviceId) {
      if (this._playableAudioPromise) {
         var playableAudioWithTimeout = Promise.race([
            this._playableAudioPromise,
            new Promise(function(resolve, reject){
               global.setTimeout(function(){reject("Timed out waiting for playable audio");}, 3000/*ms*/);
            })
         ]);
         return playableAudioWithTimeout.then(function(audio){
            if (audio.setSinkId) {
               return Promise.resolve(audio.setSinkId(deviceId));
            } else {
               return Promise.reject("Not supported");
            }
         });

      }

      if (global.Promise) {
         return Promise.reject("Not eligible ringtone owner");
      }
   };

   /* export connect.RingtoneEngine */
   connect.RingtoneEngine = RingtoneEngine;
})();
