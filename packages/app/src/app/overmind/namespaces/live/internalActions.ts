import {
  EditorSelection,
  IModuleState,
  IModuleStateModule,
  Module,
  Sandbox,
} from '@codesandbox/common/lib/types';
import { logBreadcrumb } from '@codesandbox/common/lib/utils/analytics/sentry';
import { getTextOperation } from '@codesandbox/common/lib/utils/diff';
import { Action, AsyncAction } from 'app/overmind';
import { json } from 'overmind';

import { getSavedCode } from '../../utils/sandbox';

export const clearUserSelections: Action<string | null> = (
  { state, effects },
  live_user_id
) => {
  if (!state.live.roomInfo) {
    return;
  }

  const clearSelections = (userId: string) => {
    const roomInfo = state.live.roomInfo!;
    const userIndex = roomInfo.users.findIndex(u => u.id === userId);

    effects.vscode.clearUserSelections(userId);
    if (userIndex > -1) {
      const user = roomInfo.users[userIndex];
      if (user) {
        user.selection = null;
      }
    }
  };

  if (!live_user_id) {
    // All users
    state.live.roomInfo.users.forEach(u => clearSelections(u.id));
  } else {
    clearSelections(live_user_id);
  }
};

export const reset: Action = ({ state, actions, effects }) => {
  actions.live.internal.clearUserSelections(null);
  state.live.isLive = false;
  state.live.error = null;
  state.live.isLoading = false;
  state.live.roomInfo = null;
  state.live.joinSource = 'sandbox';
  effects.live.reset();
};

export const disconnect: Action = ({ effects, actions }) => {
  effects.live.disconnect();
  actions.live.internal.reset();
};

export const initialize: AsyncAction<string, Sandbox | null> = async (
  { state, effects, actions },
  id
) => {
  state.live.isLoading = true;

  try {
    const {
      roomInfo,
      liveUserId,
      moduleState,
    } = await effects.live.joinChannel(id, reason => {
      if (reason === 'room not found') {
        actions.refetchSandboxInfo();
      }
    });

    state.live.roomInfo = roomInfo;
    state.live.liveUserId = liveUserId;

    const sandboxId = roomInfo.sandboxId;
    let sandbox = state.editor.currentSandbox;
    if (!sandbox || sandbox.id !== sandboxId) {
      sandbox = await effects.api.getSandbox(sandboxId);
      state.editor.sandboxes[sandboxId] = sandbox;
      state.editor.currentId = sandboxId;
    }

    actions.live.internal.initializeModuleState(moduleState);
    effects.live.listen(actions.live.liveMessageReceived);
    actions.live.internal.sendUnsavedChanges({ sandbox, moduleState });

    state.live.isLive = true;
    state.live.error = null;
    effects.live.markLiveReady();

    return sandbox;
  } catch (error) {
    state.live.error = error.reason;
  } finally {
    state.live.isLoading = false;
  }

  return null;
};

export const initializeModuleFromState: Action<{
  moduleShortid: string;
  moduleInfo: IModuleStateModule;
}> = ({ state, effects, actions }, { moduleShortid, moduleInfo }) => {
  const sandbox = state.editor.currentSandbox;
  if (!sandbox) {
    return;
  }

  // Module has not been saved, so is different
  const module = sandbox.modules.find(m => m.shortid === moduleShortid);

  if (module) {
    effects.live.createClient(moduleShortid, moduleInfo.revision || 0);
    if (!('code' in moduleInfo)) {
      return;
    }

    const savedCodeChanged =
      getSavedCode(moduleInfo.code, moduleInfo.saved_code) !==
      getSavedCode(module.code, module.savedCode);
    const moduleChanged =
      moduleInfo.code !== module.code ||
      moduleInfo.saved_code !== module.savedCode;

    if (moduleChanged) {
      if (moduleInfo.saved_code !== undefined) {
        module.savedCode = moduleInfo.saved_code;
      }
      if (moduleInfo.code !== undefined) {
        module.code = moduleInfo.code;
      }

      if (savedCodeChanged) {
        effects.vscode.sandboxFsSync.writeFile(
          state.editor.modulesByPath,
          module
        );
      }
      if (moduleInfo.synced) {
        effects.vscode.syncModule(module);
      } else {
        effects.vscode.setModuleCode(module);
      }
    }
  }
};

export const initializeModuleState: Action<IModuleState> = (
  { state, actions, effects },
  moduleState
) => {
  const sandbox = state.editor.currentSandbox;
  if (!sandbox) {
    return;
  }
  logBreadcrumb({
    category: 'ot',
    message: 'Applying new module state',
  });
  Object.keys(moduleState).forEach(moduleShortid => {
    const moduleInfo = moduleState[moduleShortid];

    actions.live.internal.initializeModuleFromState({
      moduleShortid,
      moduleInfo,
    });
  });
  // TODO: enable once we know exactly when we want to recover
  // actions.files.internal.recoverFiles();
  actions.editor.internal.updatePreviewCode();
};

export const getSelectionsForModule: Action<Module, EditorSelection[]> = (
  { state },
  module
) => {
  const selections: EditorSelection[] = [];
  const moduleShortid = module.shortid;

  if (!state.live.roomInfo) {
    return selections;
  }

  state.live.roomInfo.users.forEach(user => {
    const userId = user.id;
    if (
      userId === state.live.liveUserId ||
      user.currentModuleShortid !== moduleShortid ||
      (!state.live.isEditor(userId) && state.live.followingUserId !== userId)
    ) {
      return;
    }

    if (user.selection) {
      selections.push({
        userId,
        color: user.color,
        name: user.username,
        selection: json(user.selection),
      });
    }
  });

  return selections;
};

/**
 * This sends over all modules that are not synced with OT, and of which we have local changes.
 * If there's a module that has OT changes from the module_state, we ignore them.
 */
export const sendUnsavedChanges: Action<{
  sandbox: Sandbox;
  moduleState: IModuleState;
}> = ({ effects, actions }, { sandbox, moduleState }) => {
  // We now need to send all dirty files that came over from the last sandbox.
  // There is the scenario where you edit a file and press fork. Then the server
  // doesn't know about how you got to that dirty state.
  const changedModules = sandbox.modules.filter(
    m => getSavedCode(m.code, m.savedCode) !== m.code
  );
  changedModules.forEach(m => {
    if (!moduleState[m.shortid]) {
      const savedCode = getSavedCode(m.code, m.savedCode);
      // Update server with latest data
      effects.live.sendCodeUpdate(
        m.shortid,
        getTextOperation(savedCode, m.code || '')
      );
    }
  });
};
