/*jslint eqeq: true, white: true */
'use strict';

function TasksService(BackendClientService, TagsService, ListsService, UserSessionService) {

  var context, projects, subtasks, tasks, project;
  context = [];
  tasks = [];
  projects = [];
  subtasks = [];
  project = [];

  var putTaskContent = function(task, putTaskResponse) {
    itemsResponse.putItemContent(task, putTaskResponse);
  };

  var deleteTaskProperty = function(task, property) {
    itemsResponse.deleteItemProperty(task, property);
  };

  var checkDate = function(task) {
    if (!task.due) {
      this.deleteTaskProperty(task, 'due');
    }
  };

  var checkParentTask: function(task) {
    if (task.relationships) {
      if (!task.relationships.parentTask) {
        this.deleteTaskProperty(task.relationships, 'parentTask');
      }
    }
  };

  var checkContexts: function(task) {
    if (task.relationships) {
      if (!task.relationships.tags) {
        this.deleteTaskProperty(task.relationships, 'tags');
      }
    }
  };

  return {
    putTask: function(task) {
      return BackendClientService.put('/api/' + UserSessionService.getActiveUUID() + '/task', task).then(function(putTaskResponse) {
        return putTaskResponse.data;
      });
    },
    putExistingTask: function(task) {
      return BackendClientService.put('/api/' + UserSessionService.getActiveUUID() + '/task/' + task.uuid, task).then(function(putExistingTaskResponse) {
        tasksResponse.putTaskContent(task, putExistingTaskResponse.data);
      });
    },
    deleteTask: function(task) {
      return BackendClientService['delete']('/api/' + UserSessionService.getActiveUUID() + '/task/' + task.uuid).then(function(deleteTaskResponse) {
        return deleteTaskResponse.data;
      });
    },
    completeTask: function(task) {
      return BackendClientService.post('/api/' + UserSessionService.getActiveUUID() + '/task/' + task.uuid + '/complete').then(function(completeTaskResponse) {
        return completeTaskResponse.data;
      });
    },
    uncompleteTask: function(task) {
      return BackendClientService.post('/api/' + UserSessionService.getActiveUUID() + '/task/' + task.uuid + '/uncomplete').then(function(uncompleteTaskResponse) {
        return uncompleteTaskResponse.data;
      });
    },
    itemToTask: function(item) {
      return this.putExistingTask(item).then(function() {
        this.putNewTask(item);
      });
    },
    itemToTaskDone: function(item) {
      itemsArray.removeItem(item);
      this.checkParentTask(item);

      this.putExistingTask(item);
    },
    setTasks: function(tasksResponse) {

      itemsArray.clearArray(tasks);

      if (tasksResponse != null) {
        var i = 0;

        while (tasksResponse[i]) {
          this.setTask(tasksResponse[i]);
          i++;
        }
      }
    },
    setTask: function(task) {
      if (!itemsArray.itemInArray(tasks, task.uuid)) {
        tasks.push(task);
      }
    },
    removeTask: function(task) {
      this.removeItemFromArray(tasks, task);

      if (task.relationships) {
        if (task.relationships.parentTask) {
          this.removeProject(task.relationships.parentTask);
        }
      }
    },
    removeSubtask: function(task) {
    },
    removeProject: function(uuid) {

      if (this.getSubtasksByProjectUUID(uuid).length === 0) {
        var task = this.getProjectByUUID(uuid);
        this.deleteTaskProperty(task, 'project');
      }
    },
    removeTaskFromContext: function(task) {
      itemsArray.removeItemFromArray(context, task);
    },
    getTasks: function() {
      return tasks;
    },
    getProjectByUUID: function(uuid) {
      return itemsArray.getItemByUUID(tasks, uuid);
    },
    getSubtaskByUUID: function(uuid) {
      return itemsArray.getItemByUUID(subtasks, uuid);
    },
    getSubtasksByProjectUUID: function(uuid) {
      project = itemsArray.getItemsByProjectUUID(tasks, uuid);
      return project;
    },
    getSubtasksByTagUUID: function(uuid) {
      context = itemsArray.getItemsByTagUUID(tasks, uuid);
      return context;
    },
    getTaskByUUID: function(uuid) {
      return itemsArray.getItemByUUID(tasks, uuid);
    },
    deleteTaskProperty: function(task, property) {
      var parentTaskUUID;

      if(property === 'parentTask'){
        parentTaskUUID = task.parentTask;
      }

      itemsArray.deleteItemProperty(task, property);

      if(parentTaskUUID){
        this.removeProject(parentTaskUUID);
      }
    },
    setProject: function(task) {
      if (!itemsArray.itemInArray(projects, task.uuid)) {
        projects.push(task);
      }
    },
    getProjects: function() {
      return projects;
    },
    setSubtask: function(task) {
      if (!itemsArray.itemInArray(subtasks, task.uuid)) {
        subtasks.push(task);
      }
    },
    getSubtasks: function() {
      return subtasks;
    },
    putNewTask: function(task) {
      if (!itemsArray.itemInArray(tasks, task.uuid)) {
        tasks.push(task);
      }
    }
  };
};
TasksService.$inject = ['BackendClientService', 'TagsService', 'ListsService', 'UserSessionService'];
angular.module('em.services').factory('TasksService', TasksService);