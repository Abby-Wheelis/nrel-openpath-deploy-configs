import { readFile } from "node:fs/promises";
import yaml from "js-yaml";

function normalizeNewLines(str) {
  return str.replace(/\r\n/g, "\n");
}

function splitList(str){
  let list = str.split(',');
  for(let i = 0; i < list.length; i++) {
    list[i] = list[i].trim();
  }
  return list;
}

function getSurveyInfo(dataObject) {
  console.log("constructing survey info");
  let surveyInfo = {};

  //demographics survey settings
  if(dataObject.survey_form_path) {
    surveyInfo.surveys = { 
      UserProfileSurvey: {
        "formPath": "json/demo-survey-v2.json",
        "version": 1,
        "compatibleWith": 1,
        "dataKey": "manual/demographic_survey",
        "labelTemplate": {
          "en": "Answered",
          "es": "Contestada"
        }
      }
    }
  } else {
    surveyInfo.surveys = {
      UserProfileSurvey: {
        "formPath": 'https://raw.githubusercontent.com/e-mission/nrel-openpath-deploy-configs/main/survey_resources/' + dataObject.url_abbreviation + '/' + dataObject.custom_dem_survey_path,
        "version": 1,
        "compatibleWith": 1,
        "dataKey": "manual/demographic_survey",
        "labelTemplate": {
          "en": dataObject.labelTemplate_lang1.split('-')[1].trim(),
          "es": dataObject.labelTemplate_lang2.split('-')[1].trim()
        }
      }
    }
  }

  //labeling options
  if(dataObject.label_form_path){
    surveyInfo['trip-labels'] = "MULTILABEL";
  } else if (dataObject.label_options && dataObject.label_options != '') {
    surveyInfo['trip-labels'] = "MULTILABEL"; //label_options goes outside of this?
  } else {
    //TODO determine proceedure for custom label surveys
    surveyInfo['trip-labels'] = "ENKETO";
  }
}

/**
 * TODO: ensure good error messaging so deployers can fix bugs
 * fields are from the issue template
 * bodyData is from the filled out issue
 * @param {*} githubIssueTemplateFile 
 * @param {*} body 
 * @returns 
 */
export async function parseIssueBody(githubIssueTemplateFile, body) {
  let issueTemplate = await readFile(githubIssueTemplateFile, "utf8");
  let githubFormData = yaml.load(issueTemplate);

  // Markdown fields aren’t included in output body
  let fields = githubFormData.body.filter(field => field.type !== "markdown");
  console.log("got ", fields.length, " fields", fields);

  // Warning: this will likely not handle new lines in a textarea field input
  let bodyData = normalizeNewLines(body).split("\n").filter(entry => {
    return !!entry && !entry.startsWith("###")
  }).map(entry => {
    entry = entry.trim();

    return entry === "_No response_" ? "" : entry;
  });
  console.log("got form body with length ", bodyData.length, bodyData);

  //map fields and entries to an object, then we map that 
  let returnObject = {};
  for(let j = 0, k = bodyData.length; j<k; j++) {
    //skip matching if the field does not exist
    if(!fields[j]) {
      continue;
    }

    let entry = bodyData[j];

    returnObject[fields[j].id] = entry;
  }
  console.log("combined form and body to get", returnObject);

  let configObject = {};
  configObject['version'] = 1;
  configObject['ts'] = Date.now();

  let connect_url = 'https://' + returnObject.url_abbreviation + '-openpath.nrel.gov/api/';
  configObject['server'] = {connectURL: connect_url, aggregate_call_auth: 'user_only'}; //TODO check options for call + add to form?

  let subgroups = returnObject.subgroups.split(',');
  configObject['opcode'] = {autogen: returnObject.autogen, subgroups: subgroups};

  configObject['intro'] = {
    program_or_study: returnObject.program_or_study,
    start_month: returnObject.start.split( '/')[0],
    start_year: returnObject.start.split('/')[1],
    // mode_studied: , //TODO - add this to the form and find a way to maintain it as optional
    program_admin_contact: returnObject.program_admin_contact,
    deployment_partner_name: returnObject.deployment_partner_name_lang1
  };

  configObject['survey_info'] = getSurveyInfo(returnObject);
  if(returnObject.label_options) {
    configObject.label_options = 'https://raw.githubusercontent.com/e-mission/nrel-openpath-deploy-configs/main/label_options/' + returnObject.label_options;
  }

  configObject['display_config'] = { use_imperial: returnObject.use_imperial };
  configObject['metrics'] = { include_test_users: returnObject.include_test_users };
  configObject['profile_controls'] = { support_upload: false, trip_end_notification: returnObject.trip_end_notification };

  configObject['admin_dashboard'] = {
    data_trips_columns_exclude: splitList(returnObject.data_trips_columns_exclude),
    additional_trip_columns: splitList(returnObject.additional_trip_columns),
    data_uuids_columns_exclude: splitList(returnObject.data_uuids_columns_exclude),
    //TODO: will this ever NOT be nrelop?
    token_prefix: "nrelop"
  }

  //list of all the boolean values in the admin dashboard section, add to issue template and list for new value
  let ADMIN_LIST = ['overview_users', 'overview_active_users', 'overview_trips', 'overview_signup_trends', 
                    'overview_trips_trend', 'data_uuids', 'data_trips', 'token_generate', 'map_heatmap', 
                    'map_bubble', 'map_trip_lines', 'options_uuids', 'options_emails'];

  for(let i = 0; i < ADMIN_LIST.length; i++) {
    configObject['admin_dashboard'][ADMIN_LIST[i]] = returnObject[ADMIN_LIST[i]];
  }
  
  console.log( configObject );
  return configObject;
}