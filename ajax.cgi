#!/opt/app/d1fnc1c1/perl/bin/perl -w

use lib "/opt/app/d1fnc1c1/JSON-2.59/lib";
use JSON;

use libs::libConfigN;
use libs::libAux;

use CGI qw(:standard);
use strict;
use warnings;

my $ELEATROOT = libConfig::getEleatCfgVal("ELEATROOT");
my $command_name = "";
my $json_text = "";

# get the command name and value from POST
my $query = new CGI;
if ($query->param()) {
	$command_name = $query->param('command_name');
}

# get required parameters from CGI
sub get_param($) {
	my $param_name = $_[0];
	my $param_value = $query->param($param_name);
	if (!defined($param_value) || $param_value eq "") {
		print "$param_name required for $command_name command\n";
		exit;
	}
	return $param_value;
}

# parse key/value from key=value format
sub get_key_value_pair($) {
	my $cell = $_[0];
	my @key_value_pair = split("=", $cell);
	my $key = $key_value_pair[0];
	my $value = (defined($key_value_pair[1]) && $key_value_pair[1] ne "") ? $key_value_pair[1] : "";
	return ($key, $value);
}

sub purge_data($$) {
	my $match = $_[0];
	my $file_type = $_[1];
	my @result = `find $ELEATROOT/data -name $match`;
	for my $file (@result) {
		chomp($file);
		if ($file_type eq 'f' && -f $file) {
			unlink $file;
		}
		if ($file_type eq 'd' && -d $file) {
			rmdir $file;
		}
	}
}

sub get_config_info($$) {
	my $file_name = $_[0];
	my $primary_key = $_[1];
	my %node_config_info = ();
	my @node_config_file = `cat $ELEATROOT/config/CFG_$file_name.cfg | grep -v '#'`;
	my $node_config_header = $node_config_file[0];
	chomp($node_config_header);
	my @node_config_header_names = split(/\|/, $node_config_header);
	my $counter = 0;

	for my $node_config_line (@node_config_file) {
		if ($node_config_line eq $node_config_header) {
			next;
		}
		chomp($node_config_line);
		if ($node_config_line eq "") {
			next;
		}
		my %node_config_tmp = ();
		my @node_config_info_tmp = split(/\|/, $node_config_line);

		for(my $i = 0; $i <= $#node_config_info_tmp; $i++) {
			chomp($node_config_info_tmp[$i]);
			$node_config_tmp{$node_config_header_names[$i]} = $node_config_info_tmp[$i];
		}

		$node_config_info{$node_config_tmp{"$primary_key"}} = \%node_config_tmp;
		$counter++;
	}
	return %node_config_info;
}

sub get_node_info_of_node_class($) {
	my $node_class = $_[0];
	my %node_config_info = get_config_info("NODE", "NODEID");
	my %node_type_config_info = get_config_info("NODETYPE", "NODETYPEID");
	my %node_class_info = ();
	foreach my $key (keys %node_config_info) {
		my $node_type_ID = $node_config_info{$key}{"NODETYPEID"};
		if ($node_type_config_info{$node_type_ID}{"NODECLASS"} eq $node_class) {
			my $node_name = $node_config_info{$key}{"NODENAME"};
			my $gen_type = $node_type_config_info{$node_type_ID}{"GENTYPE"};
			$node_class_info{"$key"} = $node_name . " (" . $key . ":" . $gen_type . ")";
		}
	}
	return %node_class_info;
}

if ($command_name eq "") {
	print "To invoke ajax.cgi via command-line, pass in command line parameters in the form of param=value\n";
	print "For example (from ELEAT_HOME), perl www/cgi-bin/ajax.cgi command_name=command value=value1\n";
	print "The parameter, command_name, is required and can be:\n";
	print "scheduler_log - prints a tail of ELEAT_HOME/logs/scheduler.log\n";
	print "purge - takes ITN and MDN and purges all related data files\n";
	print "scheduler - sends a command to the scheduler (requires ITN, MDN, MIN, ESN, HLRNAME, SwitchName, NODEID, ActionType (DEACTIVATION, RETRY, ACTIVATION), SOURCE (TAPSS) and CFID\n";
	print "nelos - takes value and returns Nelos fields\n";
	print "monitor_ITN - takes value for ITN (or * for all) and returns data of active intercepts\n";
	print "node_groups - returns node IDs to node group mapping\n";
	print "node_config - returns node configuration information\n";
	print "node_type_config - returns node type configuration information\n";
	print "hlr - returns list of NODETYPEID to NODENAME + (NODETYPEID:GENTYPE) names for all HLRs\n";
	print "voicemail - returns list of NODETYPEID to NODENAME + (NODETYPEID:GENTYPE) names for all VoiceMails\n";
	print "get_node_IDs_for_exception_reporting - returns a list of NODEIDs that would be used if exception reporting were run now\n";
	print "run_exception_reporting - runs the (new) exception reporting script\n";
	exit;
}

# read msc_lat_long file and populate %lat_long hash
my $msc_lat_lon_file = "$ELEATROOT/config/msc_lat_lon";
my $status = open(my $msc_lat_lon_FH, '<', $msc_lat_lon_file);
if (!defined($status)) {
	# Error in open: read of $msc_lat_lon_file failed!
	exit;
}

my $headers = <$msc_lat_lon_FH>;
chomp($headers);
my @header_names = split(/\|/, $headers);
my @lines = <$msc_lat_lon_FH>;
my %lat_long = ();
my $counter = 0;
for my $line (@lines) {
	my %lat_long_tmp = ();
	my @lat_long_info = split(/\|/, $line);
	for(my $i = 0; $i <= $#lat_long_info; $i++) {
		chomp($lat_long_info[$i]);
		$lat_long_tmp{$header_names[$i]} = $lat_long_info[$i];
	}
	$lat_long{"$counter"} = \%lat_long_tmp;
	$counter++;
}

# we want consistent, unique lat/long values until we get a real mapping
# so that locations on the map upon refresh do not change each time
my @lat = ();
my @long = ();
foreach my $key ( keys %lat_long ) {
	push(@lat, $lat_long{$key}{"Latitude"});
	push(@long, $lat_long{$key}{"Longitude"});
}

my @lat_unique;
my @long_unique;
foreach my $var ( @lat ){
	if (!grep(/$var/, @lat_unique ) ){
		push( @lat_unique, $var );
	}
}
foreach my $var ( @long ){
	if (!grep(/$var/, @long_unique ) ){
		push( @long_unique, $var );
	}
}

# assign random, unqiue (for the most part) lat/long values to all NODEIDs in CFG_NODE.cfg
my @node_IDs = `cat $ELEATROOT/config/CFG_NODE.cfg | cut -f3 -d '|' | grep -v '#'`;
my %node_locs = ();
$counter = 0;
for my $node_ID (@node_IDs) {
	chomp($node_ID);
	if ($node_ID eq "") {
		next;
	}
	my %node_loc_tmp = ();
	# reset back to the first unique lat/long b/c we don't have enough values
	if ($counter eq 142) {
		$counter = 0;
	}
	$node_loc_tmp{"Latitude"} = $lat_unique[$counter];
	$node_loc_tmp{"Longitude"} = $long_unique[$counter];
	$node_locs{$node_ID} = \%node_loc_tmp;

	$counter++;
}

print header('application/json');

if ($command_name eq 'scheduler_log') {
	my @result = `tail $ELEATROOT/logs/scheduler.log`;
	my $result_string = join('\n', @result);
	my %return_hash = ();
	$return_hash{"scheduler_log"} = $result_string;
	$json_text = to_json(\%return_hash);
	print $json_text;
	exit;
}

if ($command_name eq 'purge') {
	my $ITN = get_param("ITN");
	my $MDN = get_param('MDN');

	purge_data("*$ITN:$MDN*", 'f');
	purge_data("*Completed:$ITN*", 'f');
	purge_data("*status:$ITN*", 'f');
	purge_data("*$ITN*", 'd');

	my %return_hash = ();
	$return_hash{"result"} = "data purged";
	$json_text = to_json(\%return_hash);
	print $json_text;
	exit;
}

if ($command_name eq 'scheduler') {
	# required for all action types
	my $ITN = get_param('ITN');
	my $MDN = get_param('MDN');
	my $MIN = get_param('MIN');
	my $ESN = get_param('ESN');
	my $HLRNAME = get_param('HLRNAME');
	my $SwitchName = get_param('SwitchName');
	my $NODEID = get_param('NODEID');
	my $ActionType = get_param('ActionType');
	my $SOURCE = get_param('SOURCE');
	my $CFID = get_param('CFID');

	# required only for ACTIVATION
	my $StartDate = "";
	my $StartTime = "";
	my $EndDate = "";
	my $EndTime = "";
	my $StartTimeOption = "";
	my $start_UTC = 1382377509;	# FIXME: hard-coded for now, need to convert StartTime into StartUTC

	# required independent of ActionType
	my $query_string = "ITN=$ITN&MDN=$MDN&MIN=$MIN&ESN=ESN&HLRNAME=HLRNAME&SwitchName=$SwitchName&NodeId=$NODEID&ActionType=$ActionType&SOURCE=$SOURCE&CFID=$CFID&StartUTC=$start_UTC&onITN=1";

	if ($ActionType eq "ACTIVATION") {
		$StartDate = get_param('StartDate');
		$StartTime = get_param('StartTime');
		$EndDate = get_param('EndDate');
		$EndTime = get_param('EndTime');
		$StartTimeOption = (get_param('StartTimeOption') eq 'true') ? 'StartTimeOption=Now' : '';
		$query_string .= "&$StartTimeOption&StartTime=$StartTime&StartDate=$StartDate&CaseID=123999&EndUTC=1385009100&TraceType=DATA&EndTime=$EndTime&EndTimeOption=LocalSwitch&EndDate=$EndDate&Duration=30&DDEAuthorized=N&GPRSSERVICES=IMSI&SECURITYLEVEL=1&UserRequestTag=tapss";
	}

	$ENV{'QUERY_STRING'} = $query_string;
	my @result = `$ELEATROOT/www/cgi-bin/postTrbshScheduler.cgi`;

	my %return_hash = ();
	$return_hash{"query_string"} = $query_string;
	$json_text = to_json(\%return_hash);
	print $json_text;
	exit;
}

if ($command_name eq 'nelos') {
	my $value = get_param("value");
	my ($nelos_data_ref, $error) = libAux::nelos_list_all($value);
	if ($error ne "") {
		my %error_hash = ();
		$error_hash{"error"} = $error;
		$json_text = to_json(\%error_hash);
		print $json_text;
		exit;
	}
	$json_text = to_json($nelos_data_ref);
	print $json_text;
	exit;
}

if ($command_name eq 'monitor_ITN') {
	my $value = get_param("value");

	# read switches from monitor ITN page and populate %switches hash
	my %switches = ();
	my @result = `$ELEATROOT/scripts/mon.pl '$value' '' '' '' 'true' | grep DATA_ONLY`;
	for my $row (@result) {
		my @cells = split(/\|/, $row);
		my %switch = ();
		for my $cell (@cells) {
			my ($key, $value) = get_key_value_pair($cell);
			chomp($value);
			$switch{$key} = $value;
			if ($key eq "DEACT_STAT" || $key eq "ACT_STAT") {
				my $status_type = libConfig::getStatusType($value);
				$switch{$key . "_TYPE"} = $status_type;
			}
		}

		$switch{"Latitude"} = $node_locs{$switch{"NODEID"}}{"Latitude"};
		$switch{"Longitude"} = $node_locs{$switch{"NODEID"}}{"Longitude"};

		$switches{$switch{"QUEUE_PAR_FILE"}} = \%switch;
	}

	# iterate over each switch, find the QUEUE_PAR_FILE and add its fields to the %switches hash
	foreach my $key ( keys %switches ) {
		my $queue_file = "$ELEATROOT/$switches{$key}{'QUEUE_PAR_FILE'}";
		chomp($queue_file);
		my $status = open(my $queue_FH, '<', $queue_file);
		if (!defined($status)) {
			# Error in open: read of $queue_file failed!
			next;
		}
		my $content = <$queue_FH>;
		my @content_cells = split(/\|/, $content);
		for my $cell (@content_cells) {
			# account for double pipes (empty cells)
			if ($cell eq "") {
				next;
			}
			my ($cell_key, $cell_value) = get_key_value_pair($cell);
			$switches{$key}{$cell_key} = $cell_value;
		}
	}

	my $provision = "$ELEATROOT/data/provision";
	my $sched_status = $provision . "/schedStatus";
	my $sched_tmp = $provision . "/schedTmp";

	# get log file(s) content
	foreach my $key ( keys %switches ) {
		my $log_file = "$sched_tmp/provTmp:$switches{$key}{'ITN'}:$switches{$key}{'MDN'}:$switches{$key}{'NODEID'}::::*ACTIVATION:*";
		my $log_file_content = "";
		#my @file_result = `ls $log_file 2> /dev/null`;

		my @file_result = `ls $log_file`;
		for my $file (@file_result) {
			my @cat_result = `cat $file`;
			for my $row (@cat_result) {
				$log_file_content .= $row . "\n";
			}
			$log_file_content .= "NEW_LOG\n";
		}
		$switches{$key}{'LOG_FILE_CONTENT'} = $log_file_content;
	}

	# get status log file(s) content
	foreach my $key ( keys %switches ) {
		my $status_log_file = "$sched_status/provStatus:$switches{$key}{'ITN'}:$switches{$key}{'MDN'}:$switches{$key}{'NODEID'}::::*ACTIVATION:*";
		my $status_log_file_content = "";
		#my @file_result = `ls $status_log_file 2> /dev/null`;
		my @file_result = `ls $status_log_file`;

		for my $file (@file_result) {
			my @cat_result = `cat $file`;
			for my $row (@cat_result) {
				$status_log_file_content .= $row . "\n";
			}
			$status_log_file_content .= "NEW_LOG\n";
		}
		$switches{$key}{'STATUS_LOG_FILE_CONTENT'} = $status_log_file_content;
	}

	# get exception reporting files content
	my ($sec, $min, $hour, $mday, $mon, $year, $wday, $yday, $isdst) = localtime time;
	$year += 1900;
	$mon += 1;
	my $date = sprintf "%04i%02i%02i%02i%02i", ${year}, ${mon}, ${mday}, ${hour}, ${min};

	foreach my $key ( keys %switches ) {
		if (defined($switches{$key}{'SOURCE'}) && $switches{$key}{'SOURCE'} ne 'ExceptionReportScript') {
			next;
		}
		my $file_name = "$date*:$switches{$key}{'NODEID'}";

		my @sched_cat = `cat $ELEATROOT/data/exceptionReports/$file_name:sched 2> /dev/null`;
		my @node_cat = `cat $ELEATROOT/data/exceptionReports/$file_name:node 2> /dev/null`;
		my @sched_excep_cat = `cat $ELEATROOT/data/exceptionReports/$file_name:sched.EXCEP 2> /dev/null`;
		my @node_excep_cat = `cat $ELEATROOT/data/exceptionReports/$file_name:node.EXCEP 2> /dev/null`;
		#print "$ELEATROOT/data/exceptionReports/$file_name:sched.EXCEP";

		my $sched_file_content = "";
		my $node_file_content = "";
		my $sched_excep_file_content = "";
		my $node_excep_file_content = "";

		for my $row (@sched_cat) {
			$sched_file_content .= $row . "\n";
		}
		for my $row (@node_cat) {
			$node_file_content .= $row . "\n";
		}
		for my $row (@sched_excep_cat) {
			$sched_excep_file_content .= $row . "\n";
		}
		for my $row (@node_excep_cat) {
			$node_excep_file_content .= $row . "\n";
		}
		#$switches{$key}{"Display All Scheduler"} = $sched_file_content;
		#$switches{$key}{"Dislay All Node"} = $node_file_content;
		#$switches{$key}{"Exceptions for Scheduler"} = $sched_excep_file_content;
		#$switches{$key}{"Exceptions for Node"} = $node_excep_file_content;
	}

	$json_text = to_json(\%switches);
	print $json_text;
	exit;
}

if ($command_name eq "node_groups") {
	my @node_groups = `cat $ELEATROOT/config/CFG_NODEGROUP.cfg | cut -f2,4 -d '|' | grep -v '#'`;
	my %node_config_info = get_config_info("NODE", "NODEID");
	my @node_IDs = ();
	my @other_node_IDs = ();
	my @known_node_IDs = ();
	foreach my $key (keys %node_config_info) {
		push(@node_IDs, $key);
	}
	my %node_groups_hash = ();
	foreach my $node_group (@node_groups) {
		chomp($node_group);
		my @node_ID_and_groups = split(/\|/, $node_group);
		# skip header
		if ($node_ID_and_groups[0] eq 'NODEGROUPID') {
			next;
		}
		my $node_groups = $node_ID_and_groups[1];
		my @node_groups_array = split(/\+/, $node_groups);
		for my $node_ID (@node_groups_array) {
			push(@known_node_IDs, $node_ID);
		}
		$node_groups_hash{$node_ID_and_groups[0]} = \@node_groups_array;
	}

	for my $node_ID (@node_IDs) {
		if ( !grep( /^$node_ID$/, @known_node_IDs ) ) {
			push(@other_node_IDs, $node_ID);
		}
	}

	$node_groups_hash{"Other"} = \@other_node_IDs;
	$json_text = to_json(\%node_groups_hash);
	print $json_text;
	exit;
}

if ($command_name eq "node_config") {
	my %node_config_info = get_config_info("NODE", "NODEID");
	$json_text = to_json(\%node_config_info);
	print $json_text;
	exit;
}

if ($command_name eq "node_type_config") {
	my %node_config_info = get_config_info("NODETYPE", "NODETYPEID");
	$json_text = to_json(\%node_config_info);
	print $json_text;
	exit;
}

if ($command_name eq "hlr") {
	my %hlr_info = get_node_info_of_node_class("HLR");
	$json_text = to_json(\%hlr_info);
	print $json_text;
	exit;
}

if ($command_name eq "voicemail") {
	my %hlr_info = get_node_info_of_node_class("VoiceMail");
	$json_text = to_json(\%hlr_info);
	print $json_text;
	exit;
}

if ($command_name eq "get_node_IDs_for_exception_reporting") {
	my %node_config_info = get_config_info("NODE", "NODEID");
	my @skip_node_IDs = `cat $ELEATROOT/config/CFG_EXCEPTIONS.cfg | cut -f2,4 -d '|' | grep -v '#'`;
	my @final_skip_node_IDs = ();
	my @node_IDs_to_process = ();
	for my $skip_node_ID (@skip_node_IDs) {
		chomp($skip_node_ID);
		if ($skip_node_ID =~ "^NODEID") {
			next;
		}
		if ($skip_node_ID eq "") {
			next;
		}
		my @line = split(/\=/, $skip_node_ID);
		my $skip_node_ID_list = $line[1];
		my @skip_node_ID_array = split(/\+/, $skip_node_ID_list);
		for my $skip (@skip_node_ID_array) {
			push(@final_skip_node_IDs, $skip);
		}
	}
	foreach my $key (keys %node_config_info) {
		if ( grep( /^$key$/, @final_skip_node_IDs ) ) {
			next;
		}
		push(@node_IDs_to_process, $key);
	}

	$json_text = to_json(\@node_IDs_to_process);
	print $json_text;
	exit;
}

if ($command_name eq "run_exception_reporting") {
	my @return = `cd /home/pi733j/eleat; perl scripts/runExceptions.pl IS_HTML=0`;
	my @col_names = ();
	my @table = ();
	my $flag = 0;

	for my $line (@return) {
		chomp($line);
		if ($line =~ '--') {
			next;
		}
		if ($line eq "") {
			next;
		}

		my @report_entries = split(/\|/, $line);
		my $size = @report_entries;

		if ($size == 1) {
			next;
		}

		if ($flag == 0) {
			for my $report_entry (@report_entries) {
				$report_entry =~ s/^\s*([^\s]*)\s*/$1/;
				if ($report_entry eq "") {
					next;
				}
				push(@col_names, $report_entry);
				$flag = 1;
			}
			next;
		}

		my $col_names_size = @col_names;
		my %tmp = ();
		my $index = 0;
		for my $report_entry (@report_entries) {
			$report_entry =~ s/^\s*([^\s]*)\s*/$1/;
			if ($report_entry eq "") {
				next;
			}
			$tmp{$col_names[$index]} = $report_entry;
			$index++;
		}
		my %dup = %tmp;
		push(@table, \%dup);
	}

	$json_text = to_json(\@table);
	print $json_text;
}

if ($json_text eq "") {
	print "Invalid command name $command_name\n";
	exit;
}
