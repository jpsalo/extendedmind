'use strict';

describe('em.controllers', function() {
  beforeEach(module('em.controllers'));

  describe('TasksController', function() {
    beforeEach(module('em.services', 'em.mockHelpers'));

    var $controller, $scope;
    var mockHttpBackendResponse;

    beforeEach(inject(function(_$controller_, _$rootScope_, _mockHttpBackendResponse_) {
      mockHttpBackendResponse = _mockHttpBackendResponse_;

      $scope = _$rootScope_.$new();
      $controller = _$controller_('TasksController', {
        $scope : $scope
      });
    }));

    it('should return logged user\'s tasks', inject(function() {
      expect($scope.items).toBe(undefined);
      $scope.items = mockHttpBackendResponse.getItemsResponse();
      expect($scope.items.length).toBe(3);
    }));
  });
});
