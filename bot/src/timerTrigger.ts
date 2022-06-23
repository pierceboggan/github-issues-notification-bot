import { AzureFunction, Context } from "@azure/functions";
import { AdaptiveCards } from "@microsoft/adaptivecards-tools";
import axios from "axios";
import notificationTemplate from "./adaptiveCards/notificationCard.json";
import { bot } from "./internal/initialize";

const STALE_DAYS = 1;

const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
  const staleIssues = await getStaleIssues();

  // By default this function will iterate all the installation points and send an Adaptive Card
  // to every installation.
  for (const target of await bot.notification.installations()) {
    await target.sendAdaptiveCard(
      AdaptiveCards.declare(notificationTemplate).render({
        title: `👋 Hello, Pierce! These issues need your attention URGENTLY.`,
        description: `Issues older than ${STALE_DAYS} days`,
        issues: staleIssues,
        notificationUrl: "https://github.com/issues/assigned",
      })
    );
  }
};

// Get issues from the GitHub API
async function getStaleIssues() {
  const issues = await getIssues();
  const staleIssues = issues.filter((issue: Issue) => {
    const issueDate = new Date(issue.updatedAt);
    const now = new Date();
    const diff = now.getTime() - issueDate.getTime();
    const diffDays = Math.ceil(diff / (1000 * 3600 * 24));
    return diffDays >= STALE_DAYS;
  });

  return staleIssues;
}

async function getIssues() {
  let issues = [];

  try {
    const body = {
      query: `query($owner:String!, $name:String!) { 
        repository(owner: $owner, name: $name) { 
          issues(first: 100, filterBy: { assignee: $owner }) { 
            edges { 
              node { 
                id
                number
                title
                updatedAt                
                url
              } 
            } 
          } 
        } 
      }`,
      variables: {
        owner: '', // TODO - Insert GitHub repository owner alias
        name: ''// TODO - Insert GitHub repository name
      },
    };

    const response = await axios.post("https://api.github.com/graphql", body, {
      headers: {
        // TODO - Insert GitHub personal access token from https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
        // Format - `Bearer AUTH_TOKEN`
        Authorization: ``
      },
    });

    const result: any = await response.data;
    issues = result.data.repository.issues.edges.map((edge: { node: any }) => {
      return edge.node;
    });
  } catch (error) {
    console.log(error);
  }

  return issues;
}

export interface Issue {
  id: string;
  number: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export default timerTrigger;
