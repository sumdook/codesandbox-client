import {
  SidebarCollectionDashboardFragment as Collection,
  SandboxFragmentDashboardFragment as Sandbox,
  Team,
  TemplateFragmentDashboardFragment as Template,
} from 'app/graphql/types';
import isSameDay from 'date-fns/isSameDay';
import isSameMonth from 'date-fns/isSameMonth';
import isSameWeek from 'date-fns/isSameWeek';
import { sortBy } from 'lodash-es';
import { parseISO } from 'date-fns';
import { derived } from 'overmind';

export type OrderBy = {
  field: string;
  order: 'desc' | 'asc';
};

export type DELETE_ME_COLLECTION = Collection & {
  name: string;
  level: number;
  parent: string;
};

export enum sandboxesTypes {
  DRAFTS = 'DRAFTS',
  TEMPLATES = 'TEMPLATES',
  DELETED = 'DELETED',
  RECENT = 'RECENT',
  HOME = 'HOME',
  TEMPLATE_HOME = 'TEMPLATE_HOME',
  RECENT_HOME = 'RECENT_HOME',
  ALL = 'ALL',
  SEARCH = 'SEARCH',
}

type State = {
  sandboxes: {
    DRAFTS: Sandbox[] | null;
    TEMPLATES: Template[] | null;
    DELETED: Sandbox[] | null;
    RECENT: Sandbox[] | null;
    SEARCH: Sandbox[] | null;
    TEMPLATE_HOME: Template[] | null;
    RECENT_HOME: Sandbox[] | null;
    ALL: {
      [path: string]: Sandbox[];
    } | null;
  };
  teams: Array<{ __typename?: 'Team' } & Pick<Team, 'id' | 'name'>>;
  allCollections: DELETE_ME_COLLECTION[] | null;
  selectedSandboxes: string[];
  trashSandboxIds: string[];
  isDragging: boolean;
  viewMode: 'grid' | 'list';
  orderBy: OrderBy;
  filters: {
    blacklistedTemplates: string[];
    search: string;
  };
  isTemplateSelected: (templateName: string) => boolean;
  getFilteredSandboxes: (
    sandboxes: Array<Sandbox | Template['sandbox']>
  ) => Sandbox[];
  recentSandboxesByTime: {
    day: Sandbox[];
    week: Sandbox[];
    month: Sandbox[];
    older: Sandbox[];
  };
  deletedSandboxesByTime: {
    week: Sandbox[];
    older: Sandbox[];
  };
};

export const state: State = {
  sandboxes: {
    DRAFTS: null,
    TEMPLATES: null,
    DELETED: null,
    RECENT: null,
    TEMPLATE_HOME: null,
    RECENT_HOME: null,
    ALL: null,
    SEARCH: null,
  },
  viewMode: 'grid',
  allCollections: null,
  teams: [],
  recentSandboxesByTime: derived(({ sandboxes }: State) => {
    const recentSandboxes = sandboxes.RECENT;

    const base: {
      day: Sandbox[];
      week: Sandbox[];
      month: Sandbox[];
      older: Sandbox[];
    } = {
      day: [],
      week: [],
      month: [],
      older: [],
    };
    if (!recentSandboxes) {
      return base;
    }

    const noTemplateSandboxes = recentSandboxes.filter(s => !s.customTemplate);
    const timeSandboxes = noTemplateSandboxes.reduce(
      (accumulator, currentValue) => {
        if (!currentValue.updatedAt) return accumulator;
        const date = parseISO(currentValue.updatedAt);
        if (isSameDay(date, new Date())) {
          accumulator.day.push(currentValue);

          return accumulator;
        }
        if (isSameWeek(date, new Date())) {
          accumulator.week.push(currentValue);

          return accumulator;
        }
        if (isSameMonth(date, new Date())) {
          accumulator.month.push(currentValue);

          return accumulator;
        }

        accumulator.older.push(currentValue);

        return accumulator;
      },
      base
    );

    return timeSandboxes;
  }),
  deletedSandboxesByTime: derived(({ sandboxes }: State) => {
    const deletedSandboxes = sandboxes.DELETED;
    if (!deletedSandboxes)
      return {
        week: [],
        older: [],
      };
    const noTemplateSandboxes = deletedSandboxes.filter(s => !s.customTemplate);
    const timeSandboxes = noTemplateSandboxes.reduce(
      (accumulator, currentValue) => {
        if (!currentValue.removedAt) return accumulator;
        if (isSameWeek(new Date(currentValue.removedAt), new Date())) {
          // these errors make no sense
          // @ts-ignore
          accumulator.week.push(currentValue);

          return accumulator;
        }
        // @ts-ignore
        accumulator.older.push(currentValue);

        return accumulator;
      },
      {
        week: [],
        older: [],
      }
    );

    return timeSandboxes;
  }),
  selectedSandboxes: [],
  trashSandboxIds: [],
  isDragging: false,
  orderBy: {
    order: 'desc',
    field: 'updatedAt',
  },
  filters: {
    blacklistedTemplates: [],
    search: '',
  },
  isTemplateSelected: derived(({ filters }: State) => (templateName: string) =>
    !filters.blacklistedTemplates.includes(templateName)
  ),
  getFilteredSandboxes: derived(
    ({ orderBy, filters }: State) => (
      sandboxes: Array<Sandbox | Template['sandbox']>
    ) => {
      const orderField = orderBy.field;
      const orderOrder = orderBy.order;
      const { blacklistedTemplates } = filters;

      const isDateField =
        orderField === 'insertedAt' || orderField === 'updatedAt';

      let orderedSandboxes = (sortBy(sandboxes, s => {
        const sandbox = s!;
        if (isDateField) {
          return +parseISO(sandbox[orderField]);
        }

        if (orderField === 'title') {
          const field = sandbox.title || sandbox.alias || sandbox.id;
          return field.toLowerCase();
        }

        return sandbox[orderField];
      }) as Sandbox[]).filter(
        x =>
          x.source &&
          x.source.template &&
          blacklistedTemplates.indexOf(x.source.template) === -1
      );

      if (orderOrder === 'desc') {
        orderedSandboxes = orderedSandboxes.reverse();
      }

      return orderedSandboxes;
    }
  ),
};
