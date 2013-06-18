// Generated by CoffeeScript 1.4.0
(function() {"use strict";

    describe("controllers", function() {
        beforeEach(module("em.services"));

        describe("latest", function() {
            var scope, ctrl, mockedLatest, $httpBackend;

            beforeEach(inject(function(_$httpBackend_, $rootScope, $controller) {

                $httpBackend = _$httpBackend_;

                var latestContent = [{
                    title : 'Why it\'s great to be a nerd'
                }, {
                    name : 'Motorola DROID'
                }];

                $httpBackend.expectGET('/api/latest').respond(latestContent);

                scope = $rootScope.$new();
                ctrl = $controller(HomeCtrl, {
                    $scope : scope
                });
            }));

            it('should create "latest" model with 2 articles', function() {
                console.log(scope.latest);
                expect(scope.latest).toEqual(undefined);
                $httpBackend.flush();

                expect(scope.latest[0].title).toEqual("Why it's great to be a nerd");
            });
        });

        describe("login", function() {

            var scope, ctrl, $httpBackend;

            beforeEach(inject(function(_$httpBackend_, $rootScope, $controller) {
                $httpBackend = _$httpBackend_;
                // $httpBackend.expectGET('static/test/json/authenticate.json').respond([{
                // token : "timo-tiuraniemi"
                // }]);
                $httpBackend.whenGET('static/test/json/authenticate.json').respond([{
                    userId : 'timo'
                }, {
                    token : 'timo-tiuraniemi'
                }]);

                $httpBackend.whenPOST('/api/authenticate', 'test, test').respond(201, '');

                scope = $rootScope.$new();
                ctrl = $controller(LoginCtrl, {
                    $scope : scope
                });
            }));

            afterEach(function() {
                $httpBackend.verifyNoOutstandingExpectation();
                $httpBackend.verifyNoOutstandingRequest();
            });

            // it('should fetch authentication token', function() {
            // $httpBackend.expectGET('static/test/json/authenticate.json');
            // $httpBackend.flush();
            // });
            //
            // it('should create "latest" model with 2 articles', function() {
            // $httpBackend.expectGET('static/test/json/authenticate.json');
            // expect(scope.auth).toEqual(undefined);
            // $httpBackend.flush();
            //
            // expect(scope.auth[1].token).toEqual("timo-tiuraniemi");
            // });

            //			it('should authenticate user', function() {
            //				$httpBackend.expectPOST('/api/authenticate', 'test, test').respond(201, '');
            //			});
        });
    });
}).call(this);
