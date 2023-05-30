/*
 * This file is part of KubeSphere Console.
 * Copyright (C) 2019 The KubeSphere Console Authors.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * KubeSphere Console is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import { isEmpty, get } from 'lodash'
import { action, observable } from 'mobx'
import { Notify } from '@kube-design/components'
import { LIST_DEFAULT_ORDER } from 'utils/constants'

import Base from 'stores/base'
import List from 'stores/base.list'

export default class RoleStore extends Base {
  roleTemplates = new List()

  @observable
  isLoading = false

  @observable
  roleCategory = []

  getPath({ cluster, workspace, namespace, devops }) {
    let path = ''

    if (cluster) {
      path += `/klusters/${cluster}`
    }

    if (namespace) {
      return `${path}/namespaces/${namespace}`
    }

    if (devops) {
      return `${path}/devops/${devops}`
    }

    if (workspace) {
      return `/workspaces/${workspace}`
    }

    return path
  }

  // TODO: 之后还需要调整
  getResourceUrl = params =>
    `kapis/iam.kubesphere.io/v1beta1${this.getPath(params)}/${this.module}`

  getListUrl = this.getResourceUrl

  constructor(module = 'roles') {
    super(module)
  }

  @action
  async fetchList({
    cluster,
    workspace,
    namespace,
    devops,
    more,
    ...params
  } = {}) {
    this.list.isLoading = true

    if (!params.sortBy && params.ascending === undefined) {
      params.sortBy = LIST_DEFAULT_ORDER[this.module] || 'createTime'
    }

    if (params.limit === Infinity || params.limit === -1) {
      params.limit = -1
      params.page = 1
    }

    params.limit = params.limit || 10

    const result = await request.get(
      this.getResourceUrl({
        cluster,
        workspace,
        namespace,
        devops,
      }),
      {
        ...params,
        annotation: 'kubesphere.io/creator',
      },
      {},
      () => {
        return { items: [] }
      }
    )

    const data = result?.items?.map(item => ({
      cluster,
      workspace,
      ...this.mapper(item, devops ? 'devopsroles' : this.module),
    }))

    this.list.update({
      data: more ? [...this.list.data, ...data] : data,
      total: result.totalItems || result.total_count || data.length || 0,
      ...params,
      limit: Number(params.limit) || 10,
      page: Number(params.page) || 1,
      isLoading: false,
      ...(this.list.silent ? {} : { selectedRowKeys: [] }),
    })
  }

  @action
  batchDelete(rowKeys, { cluster, workspace, namespace }) {
    if (rowKeys.some(name => this.checkIfIsPresetRole(name))) {
      Notify.error(t('DELETING_PRESET_ROLES_NOT_ALLOWED'))
      return
    }

    return this.submitting(
      Promise.all(
        rowKeys.map(rowKey =>
          request.delete(
            this.getDetailUrl({ name: rowKey, cluster, workspace, namespace })
          )
        )
      )
    )
  }

  @action
  fetchTemplatesCategory = async categoryModule => {
    const labelSelector = `scope.iam.kubesphere.io/${categoryModule}=`
    const categoryUrl = `kapis/iam.kubesphere.io/v1beta1/categories`
    this.isLoading = true

    const res = await request.get(categoryUrl, {
      labelSelector,
    })

    let data = []

    if (Array.isArray(res.items)) {
      data = res.items.map(item => {
        return {
          name: get(item, 'metadata.name'),
          displayName: get(item, 'spec.displayName'),
        }
      })
    }
    this.roleCategory = data
    this.isLoading = false
    return data
  }

  @action
  fetchRoleTemplates = async tempModule => {
    this.roleTemplates.isLoading = true

    const result = await request.get(
      `kapis/iam.kubesphere.io/v1beta1/roletemplates`,
      {
        labelSelector:
          tempModule === 'global'
            ? `iam.kubesphere.io/role-template=true`
            : `scope.iam.kubesphere.io/${tempModule}=,iam.kubesphere.io/role-template=true`,
      }
    )
    const data = get(result, 'items', []).map(item =>
      this.mapper(item, this.module)
    )

    this.roleTemplates.update({
      data,
      total: result.totalItems || result.total_count || 0,
      isLoading: false,
    })
  }

  @action
  delete({ cluster, name, workspace, namespace }) {
    if (this.checkIfIsPresetRole(name)) {
      Notify.error(t('DELETING_PRESET_ROLES_NOT_ALLOWED'))
      return
    }

    return this.submitting(
      request.delete(this.getDetailUrl({ cluster, name, workspace, namespace }))
    )
  }

  @action
  checkName(params) {
    return request.get(
      this.getDetailUrl(params),
      {},
      {
        headers: { 'x-check-exist': true },
      }
    )
  }

  checkIfIsPresetRole(name) {
    if (this.module === 'roles') {
      return (
        isEmpty(globals.config.presetRoles) &&
        globals.config.presetRoles.includes(name)
      )
    }

    return (
      isEmpty(globals.config.presetClusterRoles) &&
      globals.config.presetClusterRoles.includes(name)
    )
  }
}
