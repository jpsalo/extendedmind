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
 'use strict';

 function taskListCompletedDirective() {
  return {
    restrict: 'A',
    require: '^list',
    scope: true,
    templateUrl: 'static/app/tasks/taskListCompleted.html',
    compile: function(){
      return {
        post: function(scope, element, attrs, listController) {

          var showCompletedTasks = false;
          scope.toggleShowCompletedTasks = function () {
            showCompletedTasks = !showCompletedTasks;
          };

          var disableCompleted;
          scope.isCompletedDisabled = function() {
            return disableCompleted;
          };

          scope.containsCompleted = function(){
            var taskArray = scope.getList();
            if (taskArray && taskArray.length){
              for (var i = 0; i < taskArray.length;i++){
                if (taskArray[i].completed && !scope.isTaskFrozen(taskArray[i])){
                  return true;
                }
              }
            }
            showCompletedTasks = false;
          };
          function filterCompletedTasks(task, pastDate){
            if (pastDate) {
              disableCompleted = true;
              if (task.completed) {
                // Match task completed on past date.
                return (new Date(task.completed).setHours(0, 0, 0, 0) ===
                        new Date(pastDate).setHours(0, 0, 0, 0));
              }
              return false;
            }
            disableCompleted = false;

            if (!showCompletedTasks && task.completed && !scope.isTaskFrozen(task)) {
              return false;
            }
            return true;
          }
          listController.setCustomFilterItemVisible(filterCompletedTasks);
        }
      };
    }
  };
}
angular.module('em.base').directive('taskListCompleted', taskListCompletedDirective);