import { readFile } from "node:fs/promises";

import yaml from "js-yaml";

function removeNewLines(str) {
  return str.replace(/[\r\n]*/g, "");
}
function normalizeNewLines(str) {
  return str.replace(/\r\n/g, "\n");
}

export async function parseIssueBody(githubIssueTemplateFile, body) {
  let issueTemplate = await readFile(githubIssueTemplateFile, "utf8");
  let githubFormData = yaml.load(issueTemplate);

  // Markdown fields aren’t included in output body
  let fields = githubFormData.body.filter(field => field.type !== "markdown");

  // Warning: this will likely not handle new lines in a textarea field input
  let bodyData = normalizeNewLines(body).split("\n").filter(entry => {
    return !!entry && !entry.startsWith("###")
  }).map(entry => {
    entry = entry.trim();

    return entry === "_No response_" ? "" : entry;
  });

  console.log( { fields, bodyData } );

  let configObject = {};
  for(let j = 0, k = bodyData.length; j<k; j++) {
    configObject['version'] = 1;
    configObject['ts'] = Date.now();

    let connect_url = 'https://' + bodyData['url_abbreviation'] + '-openpath.nrel.gov/api/';
    configObject['server'] = {connectURL: connect_url, aggregate_call_auth: 'user_only'}; //TODO check options for call + add to form?

    let subgroups = bodyData['subgroups'].split(',');
    configObject['opcode'] = {autogen: bodyData['autogen'], subgroups: subgroups};

    configObject['intro'] = {
      program_or_study: bodyData['program_or_study'],
      start_month: bodyData['start'].split('/')[0],
      start_year: bodyData['start'].split('/')[1],
      // mode_studied: , //TODO - add this to the form and find a way to maintain it as optional
      program_admin_contact: bodyData['program_admin_contact'],
      deployment_partner_name: bodyData['deployment_partner_name_lang1']
    };

    // if(!fields[j]) {
    //   continue;
    // }

    // let entry = bodyData[j];
    // let attributes = fields[j] && fields[j].attributes || {};
    // // let fieldLabel = attributes.label || "";
    // let fieldDescription =  attributes.description || "";

    // // Only supports a single checkbox (for now)
    // if(fields[j].type === "checkboxes") {
    //   entry = removeNewLines(entry);
    //   // Convert to Boolean
    //   entry = entry.startsWith("- [X]");
    // }

    // returnObject[fields[j].id] = entry;
  }

  console.log( { configObject } );
  return configObject;
}