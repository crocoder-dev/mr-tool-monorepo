import type { SourceControl, Pagination, TimePeriod } from "../source-control";
import type { Gitlab as GitlabType } from '@gitbeaker/core';
import type { NewRepository, NewNamespace, NewMergeRequest, NewMember } from "@acme/extract-schema";
import { Gitlab } from '@gitbeaker/rest';

export class GitlabSourceControl implements SourceControl {
  private api: GitlabType<true>;

  constructor(token: string) {
    this.api = new Gitlab({
      oauthToken: token,
      // camelize: true
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchRepository(externalRepositoryId: number, namespaceName: string, repositoryName: string): Promise<{ repository: NewRepository, namespace?: NewNamespace }> {
    const project = await this.api.Projects.show(externalRepositoryId);
    const namespace = project.namespace;

    return {
      repository: {
        externalId: project.id,
        name: project.name
      } satisfies NewRepository,
      namespace: {
        externalId: namespace.id,
        name: namespace.name,
      } satisfies NewNamespace,
    };
  }

  async fetchMembers(externalRepositoryId: number, namespaceName: string, repositoryName: string, page?: number, perPage?: number): Promise<{ members: NewMember[], pagination: Pagination }> {
    const { data, paginationInfo } = await this.api.ProjectMembers.all(externalRepositoryId, {
      perPage,
      page,
      pagination: 'offset',
      showExpanded: true,
    });

    return {
      members: data.map(member => ({ externalId: member.id, name: member.name, username: member.username })),
      pagination: {
        page: paginationInfo.current,
        perPage: paginationInfo.perPage,
        totalPages: paginationInfo.totalPages        
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/require-await
  async fetchMergeRequests(externalRepositoryId: number, namespaceName = '', repositoryName = '', repositoryId: number, creationPeriod: TimePeriod = {}, page?: number, perPage?: number): Promise<{ mergeRequests: NewMergeRequest[], pagination: Pagination }> {
    const { data, paginationInfo } = await this.api.MergeRequests.all({
      projectId: externalRepositoryId,
      page,
      perPage,
      pagination: 'offset',
      showExpanded: true,
      createdAfter: creationPeriod.from?.toISOString(),
      createdBefore: creationPeriod.to?.toISOString(),
    });
    return {
      mergeRequests: data.map((mr) => ({
        externalId: mr.id,
        mergeRequestId: mr.iid,
        repositoryId
      })),
      pagination: {
        page: paginationInfo.current,
        perPage: paginationInfo.perPage,
        totalPages: paginationInfo.totalPages
      }
    }
  }
}
