'use strict';

function OmnibarController($q, $scope, $timeout, UISessionService, ItemsService, NotesService, TasksService/*, AnalyticsService*/) {

  $scope.omnibarText = {};
  $scope.omnibarVisible = false;
  $scope.searchText = {};
  $scope.omnibarKeywords = {isVisible: false};
  $scope.isItemEditMode = false;

  $scope.isOmnibarToastNotificationVisible = false;

  var omnibarInputFocusCallbackFunction;

  var omnibarFeatures = {
    search: {
      inputPlaceholder: 'save / recall',
      footerSaveText: 'save to inbox',
      toasterNotificationText: 'inbox',
      getItemSaveMethod: function() {
        return ItemsService.saveItem.bind(ItemsService);
      },
      isActive: true  // default feature
    },
    task: {
      inputPlaceholder: 'add task',
      footerSaveText: 'save',
      toasterNotificationText: 'tasks',
      getItemSaveMethod: function() {
        return TasksService.saveTask.bind(TasksService);
      }
    },
    note: {
      inputPlaceholder: 'add note',
      footerSaveText: 'save',
      toasterNotificationText: 'notes',
      getItemSaveMethod: function() {
        return $scope.saveNote;
      },
      initializeItemFuncion: $scope.initializeOmnibarNote
    }
  };

  var marginTopHeight = 12, omnibarActionsHeight = 44, unknownHeight = 142;

  $scope.getOmnibarFeatureHeight = function getOmnibarFeatureHeight() {
    if ($scope.currentHeight <= 810) {
      return $scope.currentHeight - unknownHeight - marginTopHeight + ($scope.isItemEditMode ? omnibarActionsHeight : 0);
    }
    return 648;
  };

  $scope.closeOmnibar = function closeOmnibar() {
    if ($scope.omnibarVisible) $scope.omnibarVisible = false;
  };

  $scope.omnibarHasText = function omnibarHasText() {
    return $scope.omnibarText.title && $scope.omnibarText.title.length !== 0;
  };

  $scope.isSearchActive = function isSearchActive() {
    return $scope.searchText.delayed && $scope.searchText.delayed.length > 1;
  };
  $scope.$watch('omnibarText.title', function(newTitle/*, oldTitle*/) {
    $scope.searchText.current = newTitle;
    if (newTitle && newTitle.length > 1){
      // Use a delayed update for search
      $timeout(function(){
        if ($scope.searchText.current === newTitle){
          $scope.searchText.delayed = newTitle;
        }
      }, 700);
    } else {
      $scope.searchText.delayed = undefined;
    }
  });

  // TODO analytics visit omnibar
  $scope.openOmnibar = function openOmnibar(feature) {
    initializeNewItemFromOmnibarText(feature);
    $scope.setOmnibarFeatureActive(feature);
    $scope.omnibarVisible = true;
  };

  $scope.editItemInOmnibar = function editItemInOmnibar(item, feature) {
    $scope.isItemEditMode = true;
    $scope.omnibarText = item;
    $scope.openOmnibar(feature);
  };

  $scope.omnibarKeyDown = function omnibarKeyDown(event) {
    if (event.keyCode === 27) $scope.clearAndHideOmnibar();
  };

  $scope.hideEmptyOmnibar = function hideEmptyOmnibar() {
    if (!$scope.isSearchActive()) $scope.clearAndHideOmnibar();
  };

  var toasterNotificationTimer, toasterNotificationVisibleInMilliseconds = 2000;

  $scope.displayOmnibarToastNotification = function displayOmnibarToastNotification(activeOmnibarFeature) {
    if (angular.isDefined(toasterNotificationTimer)) {
      $timeout.cancel(toasterNotificationTimer);
    }
    $scope.savedItem = {
      title: $scope.omnibarText.title,
      saveLocation: omnibarFeatures[activeOmnibarFeature].toasterNotificationText
    };
    $scope.isOmnibarToastNotificationVisible = true;
    toasterNotificationTimer = $timeout(function() {
      $scope.isOmnibarToastNotificationVisible = false;
    }, toasterNotificationVisibleInMilliseconds);
  };

  $scope.hideOmnibarToastNotification = function hideOmnibarToastNotification() {
    $scope.isOmnibarToastNotificationVisible = false;
  };

  $scope.saveOmnibarText = function saveOmnibarText() {
    var activeOmnibarFeature;
    if ($scope.omnibarHasText() && !$scope.isLoading) {
      activeOmnibarFeature = $scope.getActiveOmnibarFeature();
      $scope.displayOmnibarToastNotification(activeOmnibarFeature);
      saveItem(omnibarFeatures[activeOmnibarFeature].getItemSaveMethod(), $scope[activeOmnibarFeature]).then(function() {
        initializeNewItemFromOmnibarText(activeOmnibarFeature);
      });
    }
  };
  function saveItem(saveItemFunction, item) {
    return saveItemFunction(item, UISessionService.getActiveUUID()).then($scope.isItemEditMode ? $scope.clearAndHideOmnibar : $scope.clearOmnibar);
  }

  $scope.isOmnibarFeatureActive = function isOmnibarFeatureActive(feature) {
    return omnibarFeatures[feature].isActive;
  };

  $scope.setOmnibarFeatureActive = function setOmnibarFeatureActive(activeFeature) {
    for (var omnibarFeature in omnibarFeatures) {
      if (omnibarFeatures.hasOwnProperty(omnibarFeature)) {
        if (omnibarFeature === activeFeature) {
          omnibarFeatures[omnibarFeature].isActive = true;
        } else {
          omnibarFeatures[omnibarFeature].isActive = false;
          delete $scope[omnibarFeature];
        }
      }
    }
    if (!$scope.isItemEditMode) {
      deleteOmnibarItemContent();
      initializeNewItemFromOmnibarText(activeFeature);
    }
    setFocusOnEmptyOmnibarInput();
  };

  function deleteOmnibarItemContent() {
    for (var itemValue in $scope.omnibarText) {
      if ($scope.omnibarText.hasOwnProperty(itemValue)) {
        if (itemValue !== 'title') {
          delete $scope.omnibarText[itemValue];
        }
      }
    }
  }

  function initializeNewItemFromOmnibarText(feature) {
    if (omnibarFeatures[feature].initializeItemFuncion) omnibarFeatures[feature].initializeItemFuncion($scope.omnibarText);
    else {
      $scope[feature] = {};
      $scope[feature] = $scope.omnibarText;
    }
  }

  $scope.registerOmnibarInputFocusCallback = function registerOmnibarInputFocusCallback(omnibarInputFocusCallback) {
    omnibarInputFocusCallbackFunction = omnibarInputFocusCallback;
  };

  function setFocusOnEmptyOmnibarInput() {
    if (!$scope.omnibarHasText() && omnibarInputFocusCallbackFunction) omnibarInputFocusCallbackFunction();
  }

  $scope.getOmnibarFooterSaveText = function getOmnibarFooterSaveText() {
    return getActiveOmnibarFeatureValue('footerSaveText');
  };
  $scope.getOmnibarInputPlaceholder = function getOmnibarInputPlaceholder() {
    return getActiveOmnibarFeatureValue('inputPlaceholder');
  };

  $scope.getActiveOmnibarFeature = function getActiveOmnibarFeature() {
    for (var omnibarFeature in omnibarFeatures) {
      if (omnibarFeatures.hasOwnProperty(omnibarFeature)) {
        if (omnibarFeatures[omnibarFeature].isActive) return omnibarFeature;
      }
    }
  };

  function getActiveOmnibarFeatureValue(valueName) {
    var activeOmnibarFeature = $scope.getActiveOmnibarFeature();
    return omnibarFeatures[activeOmnibarFeature][valueName];
  }

  // KEYWORDS

  var selectedOmnibarKeywords = [];

  $scope.getSelectedAndFilterUnselectedKeywords = function getSelectedAndFilterUnselectedKeywords() {
    if ($scope.searchText.delayed) {
      return $scope.keywords.filter(function(keyword) {
        return selectedOmnibarKeywords.indexOf(keyword) !== -1 || keyword.title.indexOf($scope.searchText.delayed) !== -1;
      });
    } else {
      return $scope.keywords;
    }
  };

  $scope.getFilteredOmnibarNotes = function getFilteredOmnibarNotes() {
    // show nothing if no keywords selected
    if (selectedOmnibarKeywords.length) {
      var filteredNotes = [];

      $scope.notes.forEach(function(note) {
        if (note.relationships && note.relationships.tags) {
          if (selectedOmnibarKeywords.every(function(keyword) {
            return (note.relationships.tags.indexOf(keyword.uuid) !== -1);
          })) {
            filteredNotes.push(note);
          }
        }
      });
      return filteredNotes;
    }
  };

  $scope.toggleKeywordSelected = function toggleKeywordSelected(keyword) {
    var toggledKeywordIndex = selectedOmnibarKeywords.indexOf(keyword);
    if (toggledKeywordIndex === -1) {
      selectedOmnibarKeywords.push(keyword);
    } else {
      selectedOmnibarKeywords.splice(toggledKeywordIndex, 1);
    }
  };

  $scope.toggleOmnibarKeywordsVisible = function toggleOmnibarKeywordsVisible() {
    $scope.omnibarKeywords.isVisible = !$scope.omnibarKeywords.isVisible;
    if ($scope.omnibarKeywords.isVisible) selectedOmnibarKeywords = [];
  };

  // TEARDOWN

  $scope.clearOmnibar = function clearOmnibar() {
    $scope.omnibarText = {};
  };

  $scope.clearAndHideOmnibar = function clearAndHideOmnibar() {
    $scope.clearOmnibar();
    $scope.omnibarVisible = false;
    $scope.isItemEditMode = false;
    $scope.omnibarKeywords.isVisible = false;
    selectedOmnibarKeywords = [];
  };
}

OmnibarController.$inject = ['$q', '$scope', '$timeout', 'UISessionService', 'ItemsService', 'NotesService', 'TasksService'/*, 'AnalyticsService'*/];
angular.module('em.app').controller('OmnibarController', OmnibarController);