import axios, { AxiosInstance } from 'axios';
import { ACTION_STATUS } from './RepositoryNavigator/const';
import { ACTION_STATUS_MEDIA_TYPE, ACTION_SUMMARY_MEDIA_TYPE, ActionStatus } from './RepositoryNavigator/types';

const POLLING_INTERVAL = 2000;
export type ActionPollingParams = {
  token: string;
  data?: any;
};

export type StartPollingFunction = (params: ActionPollingParams) => Promise<typeof params.data>;
export type EndPollingFunction = (token: string) => void;
export type ActionPolling = { startPolling: StartPollingFunction; endPolling: EndPollingFunction };

let actions: ActionPollingParams[] = [];
let connection: AxiosInstance;

export const startPolling = (axios: AxiosInstance, params: ActionPollingParams): Promise<typeof params.data> => {
  connection = axios;
  actions = [
    ...actions.filter((action) => action.token !== params.token),
    params,
  ];
  return getPollingPromise(params.token);
}

const endPolling = (token: string) => {
  if (actions.length > 0) {
    actions = actions.filter((action) => action.token !== token);
  }
}

const getPollingPromise = (token: string) =>
  new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const action = actions.find((action) => action.token === token);
      if (!action) {
        clearInterval(interval);
        return;
      }
      getActionStatusById(action.token)
        .then((actionStatus) => {
          if (actionStatus.summary.endTimeStamp) {
            endPolling(action.token);
            if (actionStatus.summary.completionStatus === 'ERROR') {
              reject(actionStatus);
            } else {
              resolve(actionStatus);
            }
          }
        })
        .catch((error) => {
          try {
            if (!axios.isCancel(error)) {
              throw error;
            }
          } catch (error) {
            endPolling(action.token);
          }
        });
    }, POLLING_INTERVAL);
  });


async function getActionStatusById(
  id: string,
  summaryOnly: boolean = false
): Promise<ActionStatus> {
  const headers = summaryOnly ? ACTION_SUMMARY_MEDIA_TYPE : ACTION_STATUS_MEDIA_TYPE;
  const response = await connection.get(
    `${ACTION_STATUS}/${id}`,
    {
      headers: { Accept: headers }
    })
  const data = response.data;
  if (!data) {
    return Promise.reject();
  }
  return data;
}