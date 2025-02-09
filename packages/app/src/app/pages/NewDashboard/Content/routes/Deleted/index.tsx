import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useOvermind } from 'app/overmind';
import { sandboxesTypes } from 'app/overmind/namespaces/dashboard/state';
import { Header } from 'app/pages/NewDashboard/Components/Header';
import { VariableGrid } from 'app/pages/NewDashboard/Components/VariableGrid';
import { SelectionProvider } from 'app/pages/NewDashboard/Components/Selection';
import { DashboardGridItem, PageTypes } from 'app/pages/NewDashboard/types';
import { SandboxFragmentDashboardFragment } from 'app/graphql/types';
import { getPossibleTemplates } from '../../utils';

export const Deleted = () => {
  const {
    actions,
    state: {
      activeTeam,
      dashboard: { deletedSandboxesByTime, getFilteredSandboxes, sandboxes },
    },
  } = useOvermind();

  useEffect(() => {
    actions.dashboard.getPage(sandboxesTypes.DELETED);
  }, [actions.dashboard, activeTeam]);

  const getSection = (
    title: string,
    deletedSandboxes: SandboxFragmentDashboardFragment[]
  ): DashboardGridItem[] => {
    if (!deletedSandboxes.length) return [];

    return [
      { type: 'header', title },
      ...deletedSandboxes.map(sandbox => ({
        type: 'sandbox' as 'sandbox',
        sandbox,
      })),
    ];
  };

  const items: DashboardGridItem[] = sandboxes.DELETED
    ? [
        ...getSection(
          'Archived this week',
          getFilteredSandboxes(deletedSandboxesByTime.week)
        ),
        ...getSection(
          'Archived earlier',
          getFilteredSandboxes(deletedSandboxesByTime.older)
        ),
      ]
    : [
        { type: 'header', title: 'Archived this week' },
        { type: 'skeleton-row' },
        { type: 'header', title: 'Archived earlier' },
        { type: 'skeleton-row' },
      ];

  const pageType: PageTypes = 'deleted';

  return (
    <SelectionProvider activeTeamId={activeTeam} page={pageType} items={items}>
      <Helmet>
        <title>Deleted Sandboxes - CodeSandbox</title>
      </Helmet>
      <Header
        title="Recently Deleted"
        activeTeam={activeTeam}
        showFilters
        showSortOptions
        templates={getPossibleTemplates(sandboxes.DELETED)}
      />
      <VariableGrid page={pageType} items={items} />
    </SelectionProvider>
  );
};
