/*global module, beforeEach, inject, describe, afterEach, it, expect, spyOn*/
/*jslint nomen: true */

( function() {'use strict';
    describe('em.service', function() {
      beforeEach(module('em.services'));

      describe('userAuthenticate', function() {
        beforeEach(module('em.mockHelpers'));

        describe('userAuthenticate', function() {
          var $location, httpBasicAuth, mockHttpBackendResponse, userAuthenticate, userSessionStorage;

          beforeEach(inject(function(_$location_, _httpBasicAuth_, _mockHttpBackendResponse_, _userAuthenticate_, _userSessionStorage_) {
            httpBasicAuth = _httpBasicAuth_;
            mockHttpBackendResponse = _mockHttpBackendResponse_;
            userAuthenticate = _userAuthenticate_;
            userSessionStorage = _userSessionStorage_;

          }));

          afterEach(function() {
            mockHttpBackendResponse.clearCookies();
          });

          it('should not authenticate invalid user', inject(function() {
            userAuthenticate.authenticate();
            expect(userSessionStorage.isUserAuthenticated()).toEqual(false);
          }));
        });
      });
    });
  }());
