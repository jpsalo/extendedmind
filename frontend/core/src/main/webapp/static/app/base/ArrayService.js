/* Copyright 2013-2014 Extended Mind Technologies Oy
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 /*global angular */
 'use strict';

/**
* Helper service for array manipulation.
*/
function ArrayService($rootScope, UISessionService) {

  function emitChangeEvent(data, type, item) {
    $rootScope.$emit('arrayChanged',
                     {data: data,
                      type: type,
                      item: item,
                      ownerUUID: UISessionService.getActiveUUID()});
  }

  // Modified from:
  // http://stackoverflow.com/questions/1344500/efficient-way-to-insert-a-number-into-a-sorted-array-of-numbers
  function insertItemToArray(element, array, field, reverse) {
    array.splice(locationOfItemInArray(element, array, field, reverse) + 1, 0, element);
    return array;
  }

  function locationOfItemInArray(element, array, field, reverse, start, end) {

    function compareTransField(a, b, field) {
      return a.trans[field] - b.trans[field];
    }

    var compareFn = typeof field === 'function' ? field : compareTransField;

    start = start || 0;
    end = end || array.length;

    var pivot = parseInt(start + (end - start) / 2, 10);

    if (end - start <= 1) {
      if (reverse) {
        if (array[pivot] && compareFn(array[pivot], element, field) < 0)
          return pivot - 1;
        else
          return pivot;
      }
      else {
        if (array[pivot] && compareFn(array[pivot], element, field) > 0)
          return pivot - 1;
        else
          return pivot;
      }
    }
    var compareResult = compareFn(array[pivot], element, field);
    if ((!reverse && compareResult < 0) || (reverse && compareResult > 0))
      return locationOfItemInArray(element, array, field, reverse, pivot, end);
    else
      return locationOfItemInArray(element, array, field, reverse, start, pivot);
  }

  function getFirstMatchingArrayInfoByProperty(item, otherArrays) {
    if (otherArrays) {
      for (var i=0, len=otherArrays.length; i<len; i++) {
        if (item[otherArrays[i].id]) {
          return otherArrays[i];
        }
      }
    }
  }

  function getFirstMatchingArrayInfoByUUID(uuid, otherArrays) {
    if (otherArrays) {
      for (var i=0, len=otherArrays.length; i<len; i++) {
        var itemInOtherArray = otherArrays[i].array.findFirstObjectByKeyValue('uuid', uuid, 'trans');
        if (itemInOtherArray) {
          return otherArrays[i];
        }
      }
    }
  }

  return {
    // Based on given backend response, sets active array, deleted array
    // and optionally other arrays, which are objects of type {array: [], id: ''}.
    // Returns the latest (biggest) modified value.
    setArrays: function(itemType, response, activeArray, deletedArray, otherArrays) {
      // First clear existing arrays..
      var changedArrays = [];
      activeArray.length = 0;
      changedArrays.push({type: 'active', array: activeArray});
      deletedArray.length = 0;
      changedArrays.push({type: 'deleted', array: deletedArray});
      if (otherArrays) {
        for (var i=0, len=otherArrays.length; i<len; i++) {
          otherArrays[i].array.length = 0;
          changedArrays.push({type: otherArrays[i].id, array: otherArrays[i].array});
        }
      }

      // ..then loop through response
      var latestModified;
      if (response) {
        var index = 0;
        while (response[index]) {
          var modified = this.setItem(itemType, response[index], activeArray, deletedArray, otherArrays,
                                      true);
          if (!latestModified || latestModified < modified) {
            latestModified = modified;
          }
          index++;
        }
      }

      emitChangeEvent(changedArrays, itemType);
      return latestModified;
    },
    // Based on given backend response, updates all given arrays and returns the
    // latest (biggest) modified value.
    updateArrays: function(itemType, response, activeArray, deletedArray, otherArrays) {
      if (response) {
        var i = 0;
        var latestModified;
        var skipEmit = response.length > 1;
        while (response[i]) {
          var modified = this.updateItem(itemType, response[i], activeArray, deletedArray, otherArrays,
                                         skipEmit);
          if (!latestModified || latestModified < response[i].modified) {
            latestModified = modified;
          }
          i++;
        }
        if (skipEmit){
          // Emit change event for all arrays just in case when there are more than one item updated
          var changedArrays = [];
          changedArrays.push({type: 'active', array: activeArray});
          changedArrays.push({type: 'deleted', array: deletedArray});
          if (otherArrays) {
            for (var i=0, len=otherArrays.length; i<len; i++) {
              changedArrays.push({type: otherArrays[i].id, array: otherArrays[i].array});
            }
          }
          emitChangeEvent(changedArrays, itemType);
        }
        return latestModified;
      }
    },
    // item and activeArray are mandatory, rest are optional
    getActiveArrayInfo: function(item, activeArray, deletedArray, otherArrays) {
      if (activeArray &&
          activeArray.findFirstIndexByKeyValue('uuid', item.trans.uuid, 'trans') !== undefined)
      {
        return {type: 'active', array: activeArray};
      }else if (deletedArray &&
                deletedArray.findFirstIndexByKeyValue('uuid', item.trans.uuid, 'trans') !== undefined)
      {
        return {type: 'deleted', array: deletedArray};
      }else if (otherArrays) {
        var otherArrayWithItemInfo = getFirstMatchingArrayInfoByUUID(item.trans.uuid, otherArrays);
        if (otherArrayWithItemInfo) {
          return {type: otherArrayWithItemInfo.id, array: otherArrayWithItemInfo.array};
        }
      }
    },
    // item and activeArray are mandatory, rest are optional
    removeFromArrays: function(item, itemType, activeArray, deletedArray, otherArrays) {
      var arrayInfo = this.getActiveArrayInfo(item, activeArray, deletedArray, otherArrays);
      if (arrayInfo) {
        arrayInfo.array.splice(arrayInfo.array.indexOf(item), 1);
        emitChangeEvent({type: arrayInfo.type, array: arrayInfo.array}, itemType, item);
      }
      return arrayInfo;
    },
    /*
    * itemType, item and activeArray are mandatory, rest are optional
    */
    setItem: function(itemType, item, activeArray, deletedArray, otherArrays, skipChangeEvent) {
      var otherArrayInfo = getFirstMatchingArrayInfoByProperty(item, otherArrays);
      if (deletedArray && item.trans.deleted) {
        insertItemToArray(item, deletedArray, 'deleted');
        if (!skipChangeEvent) {
          emitChangeEvent([{type: 'active', array: activeArray},
                          {type: 'deleted', array: deletedArray}],
                          itemType, item);
        }
      } else if (otherArrayInfo) {
        insertItemToArray(item, otherArrayInfo.array, otherArrayInfo.id, otherArrayInfo.reverse);
        if (!skipChangeEvent) {
          emitChangeEvent({type: otherArrayInfo.id, array: otherArrayInfo.array}, itemType, item);
        }
      } else {
        insertItemToArray(item, activeArray, 'created');
        if (!skipChangeEvent) emitChangeEvent({type: 'active', array: activeArray}, itemType, item);
      }
      return item.modified;
    },
    /*
    * itemType, item and activeArray are mandatory, rest are optional
    */
    updateItem: function(itemType, item, activeArray, deletedArray, otherArrays, skipChangeEvent) {
      var activeItemId, deletedItemId, otherArrayItemId;
      var otherArrayInfo = getFirstMatchingArrayInfoByProperty(item, otherArrays);
      var otherArrayWithItemInfo = getFirstMatchingArrayInfoByUUID(item.trans.uuid, otherArrays);

      activeItemId = activeArray.findFirstIndexByKeyValue('uuid', item.trans.uuid, 'trans');
      if (activeItemId === undefined && deletedArray) {
        deletedItemId = deletedArray.findFirstIndexByKeyValue('uuid', item.trans.uuid, 'trans');
        if (otherArrayWithItemInfo && deletedItemId === undefined) {
          otherArrayItemId = otherArrayWithItemInfo.array
                             .findFirstIndexByKeyValue('uuid', item.trans.uuid, 'trans');
        }
      }

      if (activeItemId !== undefined) {
        activeArray.splice(activeItemId, 1);
        if (item.trans.deleted) {
          insertItemToArray(item, deletedArray, 'deleted');
          if (!skipChangeEvent) {
            emitChangeEvent([{type: 'active', array: activeArray},
                            {type: 'deleted', array: deletedArray}],
                            itemType, item);
          }
        } else if (otherArrayInfo && item[otherArrayInfo.id]) {
          insertItemToArray(item, otherArrayInfo.array, otherArrayInfo.id, otherArrayInfo.reverse);
          if (!skipChangeEvent) {
            emitChangeEvent([{type: 'active', array: activeArray},
                            {type: otherArrayInfo.id, array: otherArrayInfo.array}],
                            itemType, item);
          }
        } else {
          insertItemToArray(item, activeArray, 'created');
          if (!skipChangeEvent) emitChangeEvent({type: 'active', array: activeArray}, itemType, item);
        }
      } else if (deletedItemId !== undefined) {
        deletedArray.splice(deletedItemId, 1);
        if (!item.trans.deleted) {
          if (otherArrayInfo && item[otherArrayInfo.id]) {
            insertItemToArray(item, otherArrayInfo.array, otherArrayInfo.id, otherArrayInfo.reverse);
            if (!skipChangeEvent) {
              emitChangeEvent([{type: otherArrayInfo.id, array: otherArrayInfo.array},
                              {type: 'deleted', array: deletedArray}],
                              itemType, item);
            }
          } else {
            insertItemToArray(item, activeArray, 'created');
            if (!skipChangeEvent) {
              emitChangeEvent([{type: 'active', array: activeArray},
                              {type: 'deleted', array: deletedArray}],
                              itemType, item);
            }
          }
        } else {
          insertItemToArray(item, deletedArray, 'deleted');
          if (!skipChangeEvent) emitChangeEvent({type: 'deleted', array: deletedArray}, itemType, item);
        }
      } else if (otherArrayItemId !== undefined) {
        otherArrayWithItemInfo.array.splice(otherArrayItemId, 1);
        if (item.trans.deleted) {
          insertItemToArray(item, deletedArray, 'deleted');
          if (!skipChangeEvent) {
            emitChangeEvent([{type: otherArrayWithItemInfo.id, array: otherArrayWithItemInfo.array},
                            {type: 'deleted', array: deletedArray}],
                            itemType, item);
          }
        } else if (!otherArrayInfo &&
         (!otherArrayWithItemInfo || !item[otherArrayWithItemInfo.id])) {
          // Item does not belong to a new other array, nor anymore to the other array
          // it used to belong to => it is active again.
          insertItemToArray(item, activeArray, 'created');
          if (!skipChangeEvent) {
            emitChangeEvent([{type: 'active', array: activeArray},
                            {type: otherArrayWithItemInfo.id, array: otherArrayWithItemInfo.array}],
                            itemType, item);
          }
        } else if (otherArrayInfo && (otherArrayInfo.id !== otherArrayWithItemInfo.id)) {
          // Should be placed in another other array
          insertItemToArray(item, otherArrayInfo.array, otherArrayInfo.id, otherArrayInfo.reverse);
          if (!skipChangeEvent) {
            emitChangeEvent([{type: otherArrayInfo.id, array: otherArrayInfo.array},
                            {type: otherArrayWithItemInfo.id, array: otherArrayWithItemInfo.array}],
                            itemType, item);
          }
        } else {
          // Just updating modified in current other array
          insertItemToArray(item, otherArrayWithItemInfo.array, otherArrayWithItemInfo.id,
                            otherArrayInfo.reverse);
          if (!skipChangeEvent) {
            emitChangeEvent({type: otherArrayWithItemInfo.id, array: otherArrayWithItemInfo.array},
                            itemType, item);
          }
        }
      } else {
        this.setItem(itemType, item, activeArray, deletedArray, otherArrays, skipChangeEvent);
      }

      return item.modified;
    },
    combineArrays: function(firstArray, secondArray, id, reverse) {
      function compareById(firstItem, secondItem) {

        if (reverse) {
          if (firstItem[id] > secondItem[id]) {
            return -1;
          } else if (firstItem[id] < secondItem[id]) {
            return 1;
          }
        } else {
          if (firstItem[id] < secondItem[id]) {
            return -1;
          } else if (firstItem[id] > secondItem[id]) {
            return 1;
          }
        }
        return 0;
      }
      if (!firstArray || !firstArray.length) return secondArray;
      if (!secondArray || !secondArray.length) return firstArray;

      var combinedArray = firstArray.concat(secondArray);

      // Sort combined array
      return combinedArray.sort(compareById);
    },
    combineAndSortArrays: function(firstArray, secondArray, id, reverse) {
      var combinedArray = firstArray.concat(secondArray);
      var combinedAndSortedArray = [];
      // Sort combined array
      for (var i = 0; i < combinedArray.length; i++) {
        insertItemToArray(combinedArray[i], combinedAndSortedArray, id, reverse);
      }
      return combinedAndSortedArray;
    },
    getModifiedItems: function(activeArray, deletedArray, otherArrays) {
      var i, len, modifiedItems;
      for (i=0, len=activeArray.length; i<len; i++) {
        if (activeArray[i].mod){
          if (!modifiedItems) modifiedItems = [];
          modifiedItems.push(activeArray[i]);
        }
      }
      for (i=0, len=deletedArray.length; i<len; i++) {
        if (deletedArray[i].mod){
          if (!modifiedItems) modifiedItems = [];
          modifiedItems.push(deletedArray[i]);
        }
      }
      if (otherArrays) {
        for (i=0, len=otherArrays.length; i<len; i++) {
          for (var j=0, jlen=otherArrays[i].array; j<jlen; j++) {
            if (otherArrays[i].array[j].mod) {
              if (!modifiedItems) modifiedItems = [];
              modifiedItems.push(otherArrays[i].array[j]);
            }
          }
        }
      }
      return modifiedItems;
    },
    insertItemToArray: function(element, array, field, reverse) {
      return insertItemToArray(element, array, field, reverse);
    }
  };
}

ArrayService['$inject'] = ['$rootScope', 'UISessionService'];
angular.module('em.base').factory('ArrayService', ArrayService);
