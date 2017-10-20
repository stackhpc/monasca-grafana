/*
 *   Copyright 2017 StackHPC
 *   (C) Copyright 2017 Hewlett Packard Enterprise Development LP
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import config from 'app/core/config';
import appEvents from 'app/core/app_events';
import MonascaClient from './monasca_client';


export class AlarmsPageCtrl {

  /** @ngInject */
  constructor($scope, $injector, $location, backendSrv, datasourceSrv, alertSrv) {
    this.alertSrv = alertSrv
    this.monasca = new MonascaClient(backendSrv, datasourceSrv);

    this.metricFilters = [];
    this.stateFilters = [{state:""}];
    this.severityFilters = [];
    this.sortByFilters = [];
    this.defIdFilters = [];
    this.totalFilters = [];

    this.totalQueries = "";
    this.stateQueries = "";
    this.sevQueries = "";
    this.nameQueries = "";
    this.timeQueries = "";

    this.stateAscClicked = false;
    this.stateDescClicked = false;
    this.sevAscClicked = false;
    this.sevDescClicked = false;
    this.nameAscClicked = false;
    this.nameDescClicked = true;
    this.timeAscClicked = true;
    this.timeDescClicked = false;


    this.editFilterIndex = -1;
    this.alarmCount = 0;
    this.show = 1;

    //Get alarm count
    var temp = this.monasca.countAlarms();


    this.currentPage = 0;
    this.pageSize = 20;
    this.pageCount = Math.ceil(this.alarmCount / this.pageSize);
    this.slicedAlarms = [];

    this.numberOfPages = function(){
      return Math.ceil(this.alarms.length/this.pageSize);
    }

    if ('dimensions' in $location.search()) {
      this.metricFilters = $location.search().dimensions
	.split(',')
	.map(kv => kv.split(':'))
	.map(([k, v]) => ({ metric_dimensions: k + ":" + v }));
    }

    if ('id' in $location.search()){
      this.defIdFilters[0] = $location.search().id;
    }

    this.pageLoaded = false;
    this.loadFailed = false;
    this.alarms = [];
    this.loadAlarms();

    this.suggestDimensionNames = this._suggestDimensionNames.bind(this);
    this.suggestDimensionValues = this._suggestDimensionValues.bind(this);
  }

  _suggestDimensionNames(query, callback) {
    this.monasca.listDimensionNames().then(callback);
  }

  _suggestDimensionValues(query, callback) {
    var filter = this.metricFilters[this.editFilterIndex];
    if (filter && filter.key) {
      this.monasca.listDimensionValues(filter.key).then(callback);
    }
  }

  editFilter(index) {
    this.editFilterIndex = index;
  }

  //Metric Dimension Filter add/remove

  addMetricFilter() {
    this.metricFilters.push({});
  }

  removeMetricFilter(index) {
    var filter = this.metricFilters[index];
    this.metricFilters.splice(index, 1);
  }

  //State Filter add/remove

  addStateFilter() {
    this.stateFilters.push({});
  }

  removeStateFilter(index) {
    var filter = this.stateFilters[index];
    this.stateFilters.splice(index, 1);
  }

  //Severity Filter add/remove

  addSeverityFilter() {
    this.severityFilters.push({});
  }

  removeSeverityFilter(index) {
    var filter = this.severityFilters[index];
    this.severityFilters.splice(index, 1);
  }

  //Sort by Filter add/remove
  addSortByFilter() {
    this.sortByFilters.push({});
  }

  removeSortByFilter(index) {
    var filter = this.sortByFilters[index];
    this.sortByFilters.splice(index, 1);
  }

  applyFilter() {
    // Check filter is complete before applying.
    if (this.metricFilters.every(function (f){
        f.metric_dimensions = f.key + ":" + f.value;
        return f.metric_dimensions;
    })){
      this.refreshAlarms();
      this.refreshAlarms();
    }
  }

  refreshAlarms() {
    if (this.pageLoaded) {
      this.pageLoaded = false;
      this.loadAlarms();
      this.pageLoaded = true;
    }
  }

  loadAlarms() {
    this.totalFilters = [];
    if (this.metricFilters){
      for (var i = 0; i < this.metricFilters.length; i++){
        this.totalFilters.push(this.metricFilters[i]);
      }
    }

    if (this.stateFilters){
      for (var i = 0; i < this.stateFilters.length; i++){
        this.totalFilters.push(this.stateFilters[i]);
      }
    }

    if (this.severityFilters){
      for (var i = 0; i < this.severityFilters.length; i++){
        this.totalFilters.push(this.severityFilters[i]);
      }
    }

    if (this.defIdFilters.length > 0){
      var temp = {};
      temp.alarm_definition_id = this.defIdFilters[0];
      this.totalFilters.push(temp);
    }

    if(this.sortByFilters.length > 0){
      for(var i = 0; i < this.sortByFilters.length; i++){
        var temp = {};
        //if asc or desc is specified
        if(this.sortByFilters[i].value != undefined){
          temp.sort_by = this.sortByFilters[i].key + " " + this.sortByFilters[i].value;
        }
        else{
          temp.sort_by = this.sortByFilters[i].key;
        }

        this.totalFilters.push(temp);
      }
    }

    this.monasca.listAlarms(this.totalFilters).then(alarms => {
      this.alarms = alarms;
      this.slicedAlarms = alarms;

      //Remove Z and T from timestamp
      for(var i = 0; i < this.slicedAlarms.length; i++){
        this.slicedAlarms[i].state_updated_timestamp =
          this.slicedAlarms[i].state_updated_timestamp.replace(/[A-Z.]/g, ' ');
        this.slicedAlarms[i].state_updated_timestamp =
          this.slicedAlarms[i].state_updated_timestamp.replace(/.{4}$/g, ' ');
      }

    }).catch(err => {
      this.alertSrv.set("Failed to get alarms.", err.message, 'error', 10000);
      this.loadFailed = true;
    }).then(() => {
      this.pageLoaded = true;
    });
  }

  sliceAlarms(){
    for(var i = 0; i < this.alarms.length; i++){
      if(this.currentPage == i){
        var firstIndex = this.pageSize * (i + 1);
        var secondIndex = this.pageSize * (i + 2);
        this.slicedAlarms = this.alarms.slice(firstIndex,secondIndex);
      }
    }
  }

  sliceReverse(){
    for(var i = 0; i < this.alarms.length; i++){
      if(this.currentPage == i){
        var firstIndex = this.pageSize * (i - 1);
        var secondIndex = this.pageSize * (i);
        this.slicedAlarms = this.alarms.slice(firstIndex,secondIndex);
      }
    }
  }

  setAlarmDeleting(id, deleting) {
    var index = this.alarms.findIndex(n => n.id === id);
    if (index !== -1) {
      this.alarms[index].deleting = true;
    }
  }

  alarmDeleted(id) {
    var index = this.alarms.find(n => n.id === id);
    if (index !== -1) {
      this.alarms.splice(index, 1);
    }
  }

  confirmDeleteAlarm(id) {
    this.setAlarmDeleting(id, true);

    this.monasca.deleteAlarm(id).then(() => {
      this.alarmDeleted(id);
    }).catch(err => {
      this.setAlarmDeleting(id, false);
      this.alertSrv.set("Failed to delete alarm.", err.message, 'error', 10000);
    });
  }

  deleteAlarm(alarm) {
    appEvents.emit('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete this alarm?',
      text2: alarm.name,
      yesText: "Delete",
      icon: "fa-trash",
      onConfirm: () => {
        this.confirmDeleteAlarm(alarm.id);
      }
    });
  }

  sortByTimeAsc(){
      if(!this.timeAscClicked){
        this.timeQueries = "";
        this.timeQueries += "'state_updated_timestamp asc', ";
        this.timeAscClicked = true;
        this.timeDescClicked = false;
        console.log(this.timeQueries);
      }

  }

  sortByTimeDesc(){
    if(!this.timeDescClicked){
      this.timeQueries = "";
      this.timeQueries += "'state_updated_timestamp desc', ";
      this.timeDescClicked = true;
      this.timeAscClicked = false;
      console.log(this.timeQueries);
    }

  }

  sortByNameAsc(){
    if(!this.nameAscClicked){
      this.nameQueries = "";
      this.nameQueries += "'alarm_definition_name asc', ";
      this.nameAscClicked = true;
      this.nameDescClicked = false;
      console.log(this.nameQueries);
    }

  }

  sortByNameDesc(){
    if(!this.nameDescClicked){
      this.nameQueries = "";
      this.nameQueries += "'alarm_definition_name desc', ";
      this.nameDescClicked = true;
      this.namAscClicked = false;
      console.log(this.nameQueries);
    }

  }

  sortBySeverityAsc(){
    this.alarms.sort(function(a,b){
      let aSeverity = a.alarm_definition.severity;
      let bSeverity = b.alarm_definition.severity;
      let severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

      let aVal = 0;
      let bVal = 0;

      for(let i = 0; i < severities.length; i++){
        if(aSeverity == severities[i]){
          aVal = i;
        }
        if(bSeverity == severities[i]){
          bVal = i;
        }
      }

       if(aVal > bVal){
         return -1;
       }
       if(aVal < bVal) {
         return 1;
       }
       if(aVal == bVal){
         return 0;
       }

    });

  }

  sortBySeverityDesc(){
    this.alarms.sort(function(a,b){
      let aSeverity = a.alarm_definition.severity;
      let bSeverity = b.alarm_definition.severity;
      let severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

      let aVal = 0;
      let bVal = 0;

      for(let i = 0; i < severities.length; i++){
        if(aSeverity == severities[i]){
          aVal = i;
        }
        if(bSeverity == severities[i]){
          bVal = i;
        }
      }

       if(aVal > bVal){
         return 1;
       }
       if(aVal < bVal) {
         return -1;
       }
       if(aVal == bVal){
         return 0;
       }

    });

  }

  sortByStateAsc(){
    this.alarms.sort(function(a,b){
      let aState = a.state;
      let bState= b.state;
      let states = ["OK", "UNDETERMINED", "ALARM"];

      let aVal = 0;
      let bVal = 0;

      for(let i = 0; i < states.length; i++){
        if(aState == states[i]){
          aVal = i;
        }
        if(bState == states[i]){
          bVal = i;
        }
      }

       if(aVal > bVal){
         return -1;
       }
       if(aVal < bVal) {
         return 1;
       }
       if(aVal == bVal){
         return 0;
       }

    });

  }

  sortByStateDesc(){
    this.alarms.sort(function(a,b){
      let aState = a.state;
      let bState= b.state;
      let states = ["OK", "UNDETERMINED", "ALARM"];

      let aVal = 0;
      let bVal = 0;

      for(let i = 0; i < states.length; i++){
        if(aState == states[i]){
          aVal = i;
        }
        if(bState == states[i]){
          bVal = i;
        }
      }

       if(aVal > bVal){
         return 1;
       }
       if(aVal < bVal) {
         return -1;
       }
       if(aVal == bVal){
         return 0;
       }

    });

  }



}

AlarmsPageCtrl.templateUrl = 'components/alarms.html';
