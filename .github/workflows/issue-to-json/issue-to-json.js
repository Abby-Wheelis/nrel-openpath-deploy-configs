import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { getInput, exportVariable, setFailed } from "@actions/core";
import * as github from "@actions/github";

import { parseIssueBody } from "./parse-issue-body.js";

function getFileName(abbreviation) {
  let filename = abbreviation + '.nrel-op.json';
  return filename;
}

export async function issueToJson() {
  try {
    // directory to place the file (should be configs folder)
    const outputDir = getInput("folder");

    if (!github.context.payload.issue) {
      setFailed("Cannot find GitHub issue");
      return;
    }

    let issueTemplatePath = path.join("./.github/ISSUE_TEMPLATE/", getInput("issue-template"));

    //get the information about of the issue
    let { title, number, body, user } = github.context.payload.issue;

    if (!title || !body) {
      throw new Error("Unable to parse GitHub issue.");
    }

    let configData = await parseIssueBody(issueTemplatePath, body);

    configData.opened_by = user.login;

    exportVariable("IssueNumber", number);

    // create output dir
    await mkdir(outputDir, { recursive: true });
    
    let abbrevKey = getInput("hash-property-name");
    let fileName = getFileName(configData[ abbrevKey ]);
    await writeFile(path.join(outputDir, fileName), JSON.stringify(configData, null, 2));
  } catch (error) {
    setFailed(error.message);
  }
}

export default issueToJson();