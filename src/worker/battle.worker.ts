/// <reference lib="webworker" />
import {generateTeams} from '@/engine/practice-teams';
import {BattleSession, ChoiceError, ReplayError, type StepResult} from '@/engine/session';
import type {FromWorker, ToWorker} from './protocol';

let session: BattleSession | null = null;
const post = (msg: FromWorker) => self.postMessage(msg);
const sendStep = (step: StepResult) =>
  post({type: 'step', view: step.view, log: step.log, inputLog: session!.inputLog});

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'start':
        session = new BattleSession(msg);
        sendStep(session.start());
        break;
      case 'generate':
        post({type: 'teams', ...(await generateTeams(msg.seeds))});
        break;
      case 'choose':
        if (!session) throw new Error('No battle in progress');
        sendStep(session.choose(msg.choice));
        break;
      case 'forfeit':
        if (!session) throw new Error('No battle in progress');
        sendStep(session.forfeit());
        break;
    }
  } catch (err) {
    if (err instanceof ChoiceError) post({type: 'invalid', message: err.message, view: session?.view() ?? null});
    else if (err instanceof ReplayError) post({type: 'error', message: err.message, replayFailed: true});
    else post({type: 'error', message: String((err as Error)?.stack ?? err)});
  }
};
