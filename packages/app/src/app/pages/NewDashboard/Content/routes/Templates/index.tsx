import { useOvermind } from 'app/overmind';
import { Helmet } from 'react-helmet';
import React, { useEffect } from 'react';
import { sandboxesTypes } from 'app/overmind/namespaces/dashboard/state';
import { Header } from 'app/pages/NewDashboard/Components/Header';
import { VariableGrid } from 'app/pages/NewDashboard/Components/VariableGrid';
import { SelectionProvider } from 'app/pages/NewDashboard/Components/Selection';
import { DashboardGridItem, PageTypes } from 'app/pages/NewDashboard/types';
import { TemplateFragmentDashboardFragment } from 'app/graphql/types';
import { getPossibleTemplates } from '../../utils';

export const Templates = () => {
  const {
    actions,
    state: {
      dashboard: { sandboxes, getFilteredSandboxes },
      activeTeam,
    },
  } = useOvermind();

  useEffect(() => {
    actions.dashboard.getPage(sandboxesTypes.TEMPLATES);
  }, [actions.dashboard, activeTeam]);

  const possibleTemplates = sandboxes.TEMPLATES
    ? getPossibleTemplates(sandboxes.TEMPLATES)
    : [];

  const sandboxIdsToTemplate = new Map<
    string,
    TemplateFragmentDashboardFragment
  >();

  const templates = sandboxes.TEMPLATES || [];
  templates.forEach(template => {
    sandboxIdsToTemplate.set(template.sandbox.id, template);
  });
  const filteredTemplates = getFilteredSandboxes(
    templates.map(({ sandbox }) => sandbox)
  ).map(sandbox => sandboxIdsToTemplate.get(sandbox.id));

  const items: DashboardGridItem[] = sandboxes.TEMPLATES
    ? filteredTemplates.map(template => {
        const { sandbox, ...templateValues } = template;
        return {
          type: 'template' as 'template',
          sandbox,
          template: templateValues,
        };
      })
    : [{ type: 'skeleton-row' }, { type: 'skeleton-row' }];

  const pageType: PageTypes = 'templates';
  return (
    <SelectionProvider activeTeamId={activeTeam} page={pageType} items={items}>
      <Helmet>
        <title>{activeTeam ? 'Team' : 'My'} Templates - CodeSandbox</title>
      </Helmet>
      <Header
        title="Templates"
        activeTeam={activeTeam}
        templates={possibleTemplates}
        showViewOptions
        showFilters
        showSortOptions
      />
      <VariableGrid items={items} page={pageType} />
    </SelectionProvider>
  );
};
