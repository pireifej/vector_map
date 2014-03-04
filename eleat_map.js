var beige = '#F5F5DC';
var black = '#000000';
var blue = '#0000FF';
var cyan = '#00FFFF';
var dark_green = '#B8E186';
var darker_green = '#008000';
var green = '#00FF00';
var orange = '#FFA500';
var pink = '#F9A7B0';
var purple = '#800080';
var red = '#CA0020';
var yellow = '#F8E23B';

var map;
var final_data_ITN;
var exception_report;
var final_data_nelos;
var final_node_groups;
var final_node_config;
var final_node_type_config;
var command_name;
var interval_ID;
var validation;

var ACT = "activate";
var DEACT = "deactivate";
var PEND = "pending";

var selected_switch;
var selected_marker;

function load_regions_map() {
	var map = new jvm.WorldMap({
		container: $('#world-map'),
		map: 'us_aea_en',
		regionsSelectable: true,
		markersSelectable: false,
		markerStyle: {
			initial: { fill: green },
			hover: { fill: blue }
		},
		regionStyle: {
			initial: { fill: dark_green },
			selected: { fill: yellow },
		},
		onMarkerClick: function(e, code) {
			selected_switch = final_data_ITN[code];
			selected_marker = map.markers[code];
			open_default_modal();
		},
		onMarkerLabelShow: function(event, label, index) {
			var name = "";
			if (command_name == "nelos") {
				var nelos_info = final_data_nelos[index];
				label.html("Date: " + nelos_info["Date"] + "<br>" +
							"Time: " + nelos_info["Time"] + "<br>" +
							"Longitude: " + nelos_info["Longitude"] + "<br>" +
							"Latitude: " + nelos_info["Latitude"] + "<br>" +
							"Altitude: " + nelos_info["Altitude"] + "<br>" +
							"LOC_Method: " + nelos_info["LOC_Method"] + "<br>" +
							"LOC_Accuracy: " + nelos_info["LOC_Accuracy"] + "<br>" +
							"Station Type: " + nelos_info["Station_Type"]);
			} else {
				var switch_info = final_data_ITN[index];
				var retry = "";
				if (switch_info["RETRY"] > 0) {
					retry = ", RETRY: " +
								(final_node_type_config[final_node_config[switch_info["NODEID"]]["NODETYPEID"]]["MAX_RETRY"] - switch_info["RETRY"]).toString();
				}
				label.html("ITN: " + switch_info["ITN"] + ", " + "NODEID: " + switch_info["NODEID"] + retry);
			}
		},
		onMarkerOut: function(event, code) {
			//$("#info").html("");
		}
	});

	return map;
}

function exists(assoc_array, key) {
	return (typeof assoc_array[key] != "undefined" && assoc_array[key] != "");
}

function map_clean_up() {
	for (var index in map.markers) {
		if (typeof final_data_ITN[index] == "undefined") {
			map.removeMarkers([index]);
		}
	}
}

function ensure_filter_checked() {
	var ITN_filter = $('#ITN_filter').val();

	if (ITN_filter == "") {
		$('#filter_by_ITN').prop('checked', false);
	} else {
		$('#filter_by_ITN').prop('checked', true);
	}
}

function apply_filter() {
	var ITN_filter = $('#ITN_filter').val();

	if (!$('#filter_by_ITN').is(':checked')) {
		return;
	}

	if (ITN_filter == "") {
		return;
	}

	for (var index in map.markers) {
		if (final_data_ITN[index].ITN.indexOf(ITN_filter) == -1) {
			map.removeMarkers([index]);
		}
	}
}

$("#exception_reporting").click(function() {
	var ajax_data = {
		command_name : "get_node_IDs_for_exception_reporting"
	};
	send_ajax_wrapper(ajax_data, "exception_reporting_response");
})

function exception_reporting_response(data) {
	var node_IDs_to_process = data.join(", ");
	var answer = window.confirm("About to run exception reporting with:\n " + node_IDs_to_process + "\nContinue?");
	if (answer == true) {
		var exception_report = new Array();
		// get exception report
		var ajax_data = {
			command_name : "run_exception_reporting"
		};
		send_ajax_wrapper(ajax_data, "display_exception_reports");
	}
}

function display_exception_reports(data) {
	var table1 = get_table_HTML(data[0], "Node Summary Report");
	var table2 = get_table_HTML(data[1], "Node Detail Report");
	display_new_modal(table1 + "<br><br>" + table2, "Exception Report");
}

function get_table_HTML(data, title) {
	var cols = new Array();
	var table = "";

	table += "<TABLE width='100%'>";
	table += "<CAPTION>" + title + "</CAPTION>";
	table += "<TR>";
	table += "<TD align=right nowrap>";
	table += "</TD>";
	table += "</TR>";
	table += "</TABLE>";
	table += "<TABLE border=1 cellpadding=5>";
	table += "<TR>";

	for (var key in data[0]) {
		table += "<TD bgcolor=aqua>";
		table += "<B>" + key + "</B>";
		table += "</TD>";
		cols.push(key);
	}
	table += "</TR>";

	for (var index = 0; index < data.length; index++) {
		var curr = data[index];
		table += "<TR>";
		for (var col_index = 0; col_index < cols.length; col_index++) {
			var curr_col = cols[col_index];
			table += "<TD>";
			table += curr[curr_col];
			table += "</TD>";
		}
		table += "</TR>";
	}
	table += "</TABLE>";
	return table;
}

$("#auto_refresh_on").click(function() {
	set_auto_refresh("true");
})

$("#auto_refresh_off").click(function() {
	set_auto_refresh("false");
})

$("#submit").click(function() {
	var selected_node_IDs = $('#node_IDs').val();
	for (var index in selected_node_IDs) {
		selected_switch = {
			"ITN": $('#itn').val(),
			"MDN": $('#target_value').val(),
			"MIN": $('#min').val(),
			"ESN": $('#esn').val(),
			"NODENAME": final_node_config[selected_node_IDs[index]]["NODENAME"],
			"NODEID": selected_node_IDs[index],
			"CFID": $('#CFID').val(),
			"StartDate": $('#start_date').val(),
			"StartTime": $('#start_time').val(),
			"EndDate": $('#end_date').val(),
			"EndTime": $('#end_time').val(),
			"StartTimeOption": $('#immediate').is(':checked')
		};

		activate();
	}
})

function refresh_monitor() {
	var ajax_data = {
		command_name : "monitor_ITN",
		value : "*"
	};

	send_ajax_wrapper(ajax_data, "process_response_ITN");
}

$("#nelos").click(function() {
	set_auto_refresh("false");
	command_name = "nelos";
	map.removeAllMarkers();

	var ajax_data = {
		command_name : "nelos",
		value : $('#nelos_min').val()
	};

	send_ajax_wrapper(ajax_data, "process_response_nelos");
})

function get_scheduler_log() {
	var ajax_data = {
		command_name : "scheduler_log"
	};

	send_ajax_wrapper(ajax_data, "update_scheduler_log");
}

function process_response_ITN(response) {
	final_data_ITN = new Array();
	for (var key in response) {
		var value = response[key];
		if (value["SOURCE"] == "ExceptionReportScript") {
			continue;
		}
		final_data_ITN.push(value);
	}

	// create markers and load into map
	for (var marker_index = 0; marker_index < final_data_ITN.length; marker_index++) {
		var switch_info = final_data_ITN[marker_index];
		switch_info["index"] = marker_index;
		if (exists(switch_info, 'Exceptions for Scheduler') || exists(switch_info, 'Exceptions for Node')) {
			exception_report[switch_info.NODEID] = switch_info;
		}

		// determine marker color, based on switch ACT_STAT and DEACT_STAT
		var act_stat_type = switch_info.ACT_STAT_TYPE;
		var deact_stat_type = switch_info.DEACT_STAT_TYPE;
		var color = get_switch_color(act_stat_type, deact_stat_type);
		map.addMarker(marker_index, {latLng: [switch_info.Latitude, switch_info.Longitude], style: {fill: color}});
	}
	map_clean_up();
	apply_filter();
}

function process_response_nelos(response) {
	final_data_nelos = new Array();
	for (var key in response) {
		var value = response[key];
		final_data_nelos.push(value);
	}

	// create markers and load into map
	for (var marker_index = 0; marker_index < final_data_nelos.length; marker_index++) {
		var nelos_info = final_data_nelos[marker_index];
		map.addMarker(marker_index, {latLng: [nelos_info.Latitude, nelos_info.Longitude]});
		console.log(nelos_info);
	}
}

function change_marker_color(marker, color) {
	var code = marker.element.properties['data-index'];
	var lat_lng = marker.config.latLng;
	map.removeMarkers([code]);
	map.addMarker(code, {latLng: [lat_lng[0], lat_lng[1]], style: {fill: color}});
}

function get_switch_color(act_stat_type, deact_stat_type) {
	if (act_stat_type == "WAIT FOR VER" || deact_stat_type == "WAIT FOR VER") {
		return(yellow);
	}
	if (act_stat_type == "FAILED" || deact_stat_type == "FAILED") {
		return(red);
	}
	if (act_stat_type == "RETRY" || deact_stat_type == "RETRY") {
		return(pink);
	}
	if (act_stat_type == "aDONE" || deact_stat_type == "aDONE") {
		return(beige);
	}
	if (act_stat_type == "mDONE" || deact_stat_type == "mDONE") {
		return(green);
	}
	if (act_stat_type == "PENDING" || deact_stat_type == "PENDING") {
		return(cyan);
	}
	return(black);
}

function send_ajax_wrapper(ajax_data, function_ptr) {
	var my_data = send_ajax(ajax_data);
	my_data
		.done(function(data) {
			//console.log(ajax_data.command_name + " success");
		  	//console.log(data);
			if (function_ptr != "") {
				window[function_ptr](data);
			}
		})
		.fail(function(data) {
			console.log(ajax_data.command_name + " failure");
			console.log(data);
			alert("Error - " + data.responseText);
		});
}

function send_ajax(ajax_data) {
	if (!exists(ajax_data, "command_name")) {
		console.log("Error - send_ajax requires command_name!");
		return;
	}
	return $.ajax({
		type: "GET",
		url: "/cgi-bin/ajax.cgi",
		contentType: "application/json; charset=utf-8",
		dataType: "json",
		data: ajax_data,
		statusCode: {
			404: function() {
				console.log("404 error code - page not found!\n");
			},
			500: function() {
				console.log("500 error code - time out!\n");
			},
			200: function() {
				//console.log("200 error code - response OK!\n");
			}
		}
	});
}

function send_ajax_scheduler(action_type) {
	var ajax_data = {
	 	"command_name": "scheduler",
		"ActionType": action_type,
		"ITN": selected_switch.ITN,
		"MDN": selected_switch.MDN,
		"MIN": selected_switch.MIN,
		"ESN": selected_switch.ESN,
		"HLRNAME": "HLRNAME",
		"SwitchName": selected_switch.NODENAME,
		"NODEID": selected_switch.NODEID,
		"SOURCE": "TAPSS",
		"CFID": selected_switch.CFID,
		"StartDate": selected_switch.StartDate,
		"StartTime": selected_switch.StartTime,
		"EndDate": selected_switch.EndDate,
		"EndTime": selected_switch.EndTime,
		"StartTimeOption": selected_switch.StartTimeOption
	};

	send_ajax_wrapper(ajax_data, "");
}

function activate() {
	send_ajax_scheduler("ACTIVATION");
}

function deactivate() {
	send_ajax_scheduler("DEACTIVATION");
	close_modal();
}

function retry() {
	send_ajax_scheduler("RETRY");
	close_modal();
}

function view_attrs() {
	var attributes = "";
	for (var key in selected_switch) {
		if (key == 'LOG_FILE_CONTENT') continue;
		if (key == 'STATUS_LOG_FILE_CONTENT') continue;
		if (key == 'Exceptions for Scheduler') { console.log(key); console.log(selected_switch[key]); continue; }
		if (key == 'Exceptions for Node') { console.log(key); console.log(selected_switch[key]); continue; }
		if (key == 'Dislay All Node') { console.log(key); console.log(selected_switch[key]); continue; }
		if (key == 'Display All Scheduler') { console.log(key); console.log(selected_switch[key]); continue; }
		attributes += "<b>" + key + "</b>" + ": " + selected_switch[key] + "<br>";
	}

	display_new_modal(get_modal_header(true) + "<p><code>" + attributes + "</code></p", selected_switch.ITN);
}

function view_log() {
	display_new_modal(get_modal_header(true) + get_log_content(selected_switch['LOG_FILE_CONTENT']), selected_switch.ITN);
}

function view_status_log() {
	display_new_modal(get_modal_header(true) + get_log_content(selected_switch['STATUS_LOG_FILE_CONTENT']), selected_switch.ITN);
}

function open_default_modal() {
	var modal_content = get_modal_header(false);
	modal_content += "<p onclick='activate()' style='cursor: pointer;'><code>Activate</code></p>";
	modal_content += "<p onclick='deactivate()' style='cursor: pointer;'><code>Deactivate</code></p>";
	modal_content += "<p onclick='retry()' style='cursor: pointer;'><code>Retry</code></p>";
	modal_content += "<p onclick='view_attrs()' style='cursor: pointer;'><code>View attributes</code></p>";
	modal_content += "<p onclick='view_log()' style='cursor: pointer;'><code>View Log</code></p>";
	modal_content += "<p onclick='view_status_log()' style='cursor: pointer;'><code>View Status Log</code></p>";
	modal_content += "<p onclick='purge()' style='cursor: pointer;'><code>Purge</code></p>";
	display_new_modal(modal_content, selected_switch.ITN);
}

function purge() {
	var ajax_data = {
		command_name : "purge",
		"ITN": selected_switch.ITN,
		"MDN": selected_switch.MDN
	};
	send_ajax(ajax_data, "");
	map.removeMarkers(selected_marker.element.properties['data-index']);
	close_modal();
}

function get_log_content(content) {
	var log_content = "";
	var log_files = content.split("NEW_LOG\n");
	for (var index = 0; index < log_files.length; index++) {
		if (log_files[index] == "") {
			continue;
		}
		log_content += "<TABLE width='100%'>";
		log_content += "<TR>";
		log_content += "<TD>";
		log_content += "<B>Session Details for ITN=" + selected_switch.ITN +
						" TARGET ID=" + selected_switch.MDN +
						" Element=" + selected_switch.NODEID +
						" Action=ACTIVATION (Reverse Chronological Order)</B>";
		log_content += "</TD>";
		log_content += "<TD align=right nowrap>";
		log_content += "</TD>";
		log_content += "</TR>";
		log_content += "</TABLE>";
		log_content += "<TABLE border=1 cellpadding=5>";
		// FIXME: remove hard-coded log file title, replace with actual title from server
		log_content += "<TR><TD bgcolor=aqua><B>/opt/app/d1fnc1c1/eleat2/data/provision/schedTmp/provTmp:300000:8265572040:wa1il01isc::::ACTIVATION:25027";
		log_content += "</B></TD></TR>";
		log_content += "<TR><TD><PRE>";
		var lines = log_files[index].split("\n");
		for (var index2 = 0; index2 < lines.length; index2++) {
			log_content += lines[index2].replace(/>/g, "&gt;").replace(/</g, "&lt;") + "<br>";
		}
		log_content += "</PRE></TD></TR>";
		log_content += "</TABLE><BR>";
	}

	return log_content;
}

function get_modal_header(display_back) {
	var modal_content = "<h4>ITN = " + selected_switch.ITN + "<br>MDN = " + selected_switch.MDN + "<br>MIN = " + selected_switch.MIN + "<br>NODEID = " + selected_switch.NODEID + "</h4>";
	modal_content += "<h5>Activation Status = "+ selected_switch.ACT_STAT_TYPE + "<br>";
	modal_content += "Deactivation Status = "+ selected_switch.DEACT_STAT_TYPE + "</h5>";
	if (display_back) {
		modal_content += "<p onclick='open_default_modal()' style='cursor: pointer;'><a style='color:blue;'><u>Back</u></a></p>";
	}
	return modal_content;
}

function display_new_modal(modal_content, modal_title) {
	$("#dialog").dialog({
		autoOpen: false,
		show: {
		effect: "fade",
			duration: 250
		},
		hide: {
			effect: "drop",
			duration: 1000
		},
		title: modal_title,
		width: 500
	});
	$("#dialog").html(modal_content);
	$("#dialog").dialog("open");
}

function close_modal() {
	if ($("#dialog").dialog) {
		$("#dialog").dialog("close");
	}
}

function update_scheduler_log(content) {
	content = content.scheduler_log;
	var lines = content.split("\n");
	var log_content = "";
	for (var index = 0; index < lines.length; index++) {
		log_content += lines[index].replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/\\n/, "") + "<br>";
	}

	$('#scheduler_log').html(log_content);
}

function set_auto_refresh(status) {
	if (status == "true") {
		interval_ID = setInterval(function() {
			refresh_monitor();
			get_scheduler_log();
		}, 3000);
	} else {
		clearInterval(interval_ID);
	}
}

function markers_length() {
	var length = 0;
	for (var item in map.markers) {
		length++;
	}
	return length;
}

function update_target_class() {
	var target_class = $('#target_class').val();
	if (target_class == "mobility") {
		$('#min').attr("disabled", false);
		$("label[for='target_value']").text("MDN/MSISDN");
	}
	if (target_class == "landline") {
		$('#min').attr("disabled", true);
		$("label[for='target_value']").text("MDN/MSISDN");
	}
	if (target_class == "IP") {
		$('#min').attr("disabled", true);
		$("label[for='target_value']").text("IP");
	}
}

function update_target_type() {
	var target_value = $('#target_value').val();

	if (target_value == "") {
		$("label[for='target_value']").text("Target Value");
		$("#target_value").css({"background-color": "red"});
		$("#submit").attr("disabled", true);
		return;
	}

	validation = is_valid_mdn(target_value);
	if (validation.valid == true) {
		$("label[for='target_value']").text("MDN/MSISDN");
		$("#target_value").css({"background-color": "white"});
		$("#submit").attr("disabled", false);
		console.log(validation);
		return;
	}

	validation = is_valid_IP4(target_value);
	if (validation.valid == true) {
		$("label[for='target_value']").text("IPv4 Address");
		$("#target_value").css({"background-color": "white"});
		$("#submit").attr("disabled", false);
		console.log(validation);
		return;
	}

	validation = is_valid_MAC(target_value);
	if (validation.valid == true) {
		$("label[for='target_value']").text("MAC Address");
		$("#target_value").css({"background-color": "white"});
		$("#submit").attr("disabled", false);
		console.log(validation);
		return;
	}

	validation = is_valid_IP6(target_value);
	if (validation.valid == true) {
		$("label[for='target_value']").text("IPv6 Address");
		$("#target_value").css({"background-color": "white"});
		$("#submit").attr("disabled", false);
		console.log(validation);
		return;
	}

	$("label[for='target_value']").text("Target Value");
	$("#target_value").css({"background-color": "red"});
	$("#submit").attr("disabled", true);
}

function validate_target_value() {
	if (validation.valid == false) {
		alert("Error - " + validation.message);
		return;
	}
}

// duration or start_date change, so calculate end date
function update_end_date() {
	var duration = parseInt($('#duration').val());
	if (isNaN(duration) || duration < 0) {
		duration = 0;
	}
	var start_date = new Date($('#start_date').val());
	start_date = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDate());
	start_date.setDate(start_date.getDate() + duration);
	$('#end_date').val(prepend_zero_to_time(start_date.getMonth() + 1) + '/' + prepend_zero_to_time(start_date.getDate()) + '/' + start_date.getFullYear());
}

// end_date change, so calculate start date
function update_start_date() {
	var duration = parseInt($('#duration').val());
	if (isNaN(duration) || duration < 0) {
		duration = 0;
	}
	var end_date = new Date($('#end_date').val());
	end_date = new Date(end_date.getFullYear(), end_date.getMonth(), end_date.getDate());
	end_date.setDate(end_date.getDate() - duration);
	$('#start_date').val(prepend_zero_to_time(end_date.getMonth() + 1) + '/' + prepend_zero_to_time(end_date.getDate()) + '/' + end_date.getFullYear());
}

function update_node_names() {
	var selected_node_groups = $('#node_groups').val();
	$('#node_names').html("");
	$('#node_IDs').html("");
	for (var index in selected_node_groups) {
		var curr_node_group = selected_node_groups[index];
		var node_IDs = final_node_groups[curr_node_group];
		node_IDs.sort();
		for (var node_ID_index in node_IDs) {
			var node_ID = node_IDs[node_ID_index];
			var node_name = final_node_config[node_ID]['NODENAME'];
				$('#node_names')
					.append($('<option>', { node_name : node_name })
					.text(node_name));
		}
	}
}

function update_node_info() {
	var selected_node_names = $('#node_names').val();
	$('#node_IDs').html("");
	$('#AF_name').val("");
	for (var index in selected_node_names) {
		var selected_node_name = selected_node_names[index];
		var selected_node_ID;
		for (var key in final_node_config) {
			if (final_node_config[key]['NODENAME'] == selected_node_name) {
				selected_node_ID = key;
				break;
			}
		}
		var AF_name = final_node_config[selected_node_ID]['CLLI'];
		var comma = "";
		var current_AF_name = $('#AF_name').val();
		if (current_AF_name != "") {
			comma = ", ";
		}
		$('#AF_name').val(current_AF_name + comma + AF_name);
		$('#node_IDs')
			.append($('<option>', { selected_node_ID : selected_node_ID })
			.text(selected_node_ID));
	}
}

function prepend_zero_to_time(time) {
	if (time < 10) {
		return('0' + time);
	}
	return(time);
}

function init_date_pickers() {
	$("#start_date").datepicker();
	var new_date = new Date();
	var today =(new_date.getMonth() + 1) + '/' + new_date.getDate() + '/' + new_date.getFullYear();
	var current_time = prepend_zero_to_time(new_date.getHours()) + ':' + prepend_zero_to_time(new_date.getMinutes()) + ':' + prepend_zero_to_time(new_date.getSeconds());
	$('#start_date').val(today);
	$('#start_time').val(current_time);
	$('#end_date').datepicker();
	$('#end_time').val("23:45:00");
	$('#duration').val("30");
	update_end_date();
}

function init_node_groups(data) {
	final_node_groups = data;
	var node_groups = [];
	for (var node_group in data) {
		node_groups.push(node_group);
	}
	node_groups.sort();
	for (var index in node_groups) {
		var node_group = node_groups[index];
		$('#node_groups')
			.append($('<option>', { node_group : node_group })
			.text(node_group));
	}
}

function init_node_config(data) {
	final_node_config = data;
}

function init_node_type_config(data) {
	final_node_type_config = data;
}

function init_HLR(data) {
	var hlr_names = [];
	for (var key in data) {
		hlr_names.push(data[key]);
	}
	hlr_names.sort();
	for (var index in hlr_names) {
		var hlr_name = hlr_names[index];
		$('#HLR_names')
			.append($('<option>' , { key : hlr_name })
			.text(hlr_name));
	}
}

function init_voicemail(data) {
	var voicemail_names = [];
	for (var key in data) {
		voicemail_names.push(data[key]);
	}
	voicemail_names.sort();
	for (var index in voicemail_names) {
		var voicemail_name = voicemail_names[index];
		$('#voicemail_server')
			.append($('<option>' , { key : voicemail_name })
			.text(voicemail_name));
	}
}

$(document).ready(function() {
	map = load_regions_map();
	set_auto_refresh("true");
	init_date_pickers();

	command_name = "scheduler";

	// populate Node Groups multi-selection
	var ajax_data = {
		command_name : "node_groups"
	};
	send_ajax_wrapper(ajax_data, "init_node_groups");

	// populate node configuration associative array
	var ajax_data = {
		command_name : "node_config"
	};
	send_ajax_wrapper(ajax_data, "init_node_config");

	// populate node type configuration associative array
	var ajax_data = {
		command_name : "node_type_config"
	};
	send_ajax_wrapper(ajax_data, "init_node_type_config");

	// populate HLR names multi-selection box
	var ajax_data = {
		command_name : "hlr"
	};
	send_ajax_wrapper(ajax_data, "init_HLR");

	// populate Voicemail Server selection box
	var ajax_data = {
		command_name : "voicemail"
	};
	send_ajax_wrapper(ajax_data, "init_voicemail");
})
