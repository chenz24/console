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

import { get, set, uniq, intersection } from 'lodash'
import { observable, action } from 'mobx'
import { Notify } from '@kube-design/components'
import { safeParseJSON } from 'utils'
import ObjectMapper from 'utils/object.mapper'
import cookie from 'utils/cookie'

import Base from './base'
import List from './base.list'

export default class UsersStore extends Base {
  records = new List()

  ingroup = new List()

  notingroup = new List()

  @observable
  roles = []

  module = 'users'

  getPath({ cluster, workspace, namespace, devops } = {}) {
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

  getModule({ cluster, workspace, namespace, devops } = {}) {
    if (namespace || devops) {
      return 'members'
    }

    if (workspace) {
      return 'workspacemembers'
    }

    if (cluster) {
      return 'clustermembers'
    }

    return 'users'
  }

  getResourceUrl = (params = {}) =>
    `kapis/iam.kubesphere.io/v1alpha2${this.getPath(params)}/${this.getModule(
      params
    )}`

  getListUrl = this.getResourceUrl

  @action
  async fetchRules({ name, ...params }) {
    let module = 'globalroles'
    let rolebindings = 'globalrolebindings'

    if (params.namespace || params.devops) {
      module = 'roles'
      rolebindings = 'rolebindings'
    } else if (params.workspace) {
      module = 'workspaceroles'
      rolebindings = 'workspacerolebindings'
    } else if (params.cluster) {
      module = 'clusterroles'
      rolebindings = 'clusterrolebindings'
    }

    const roleBindingUrl = `kapis/iam.kubesphere.io/v1beta1/${rolebindings}`
    const respRoleBindingRes = await request.get(roleBindingUrl, {
      ...(rolebindings === 'workspacerolebindings'
        ? {
            params: {
              labelSelector: `iam.kubesphere.io/user-ref=${params.name},kubesphere.io/workspace=${params.workspace}`,
            },
          }
        : {}),
    })

    const rolebindingsName = get(
      respRoleBindingRes,
      'items[0].roleRef.name',
      ''
    )
    // 请求 roletemplate 聚合请求
    const url = `kapis/iam.kubesphere.io/v1beta1${this.getPath(
      params
    )}/${module}/${rolebindingsName}`

    const [roleResp, roletemplatesResp] = await Promise.all([
      request.get(url),
      request.get('/kapis/iam.kubesphere.io/v1beta1/roletemplates'),
    ]).catch(() => {
      return [{}, {}]
    })

    const ruleList = safeParseJSON(
      get(
        roleResp,
        'metadata.annotations["iam.kubesphere.io/aggregation-roles"]',
        []
      ),
      []
    )

    const roletemplatesList = get(roletemplatesResp, 'items', [])

    let rules = {}

    if (ruleList.length > 0) {
      ruleList.forEach(ruleName => {
        const roletemplate = roletemplatesList.find(
          rolestemplate => get(rolestemplate, 'metadata.name') === ruleName
        )

        if (roletemplate) {
          const key =
            get(
              roletemplate,
              'metadata.labels["iam.kubesphere.io/resource"]'
            ) || ruleName
          const actionTemplate = get(
            roletemplate,
            'metadata.labels["iam.kubesphere.io/operation"]'
          )
          rules[key] = rules[key] || []
          const actions = [...rules[key], { [ruleName]: actionTemplate }]
          rules[key] = uniq(actions)
        }
      })
    }

    switch (module) {
      case 'globaleroles':
        set(globals.user, `globalRules`, rules)
        break
      case 'clusterroles': {
        const parentActions = globals.app.getActions({ module: 'clusters' })
        set(globals.user, `clusterRules[${params.cluster}]`, {
          ...rules,
          _: intersection(parentActions, ['view', 'manage']),
        })
        break
      }
      case 'workspaceroles': {
        if (params.workspace === globals.config.systemWorkspace) {
          set(globals.user, `workspaceRules[${params.workspace}]`, {
            ...globals.config.systemWorkspaceRules,
          })
          break
        }

        const parentActions = globals.app.getActions({ module: 'workspaces' })
        set(globals.user, `workspaceRules[${params.workspace}]`, {
          ...rules,
          _: intersection(parentActions, ['view', 'manage']),
        })
        break
      }
      case 'roles': {
        const obj = {}
        if (params.workspace) {
          obj.workspace = params.workspace
        } else if (params.cluster) {
          obj.cluster = params.cluster
        }

        if (params.namespace) {
          const parentActions = globals.app.getActions({
            ...obj,
            module: 'projects',
          })

          if (params.workspace === globals.config.systemWorkspace) {
            rules = globals.config.systemWorkspaceProjectRules
          }

          set(
            globals.user,
            `projectRules[${params.cluster}][${params.namespace}]`,
            {
              ...rules,
              _: intersection(parentActions, ['view', 'manage']),
            }
          )
        } else if (params.devops) {
          const parentActions = globals.app.getActions({
            ...obj,
            module: 'devops',
          })

          set(
            globals.user,
            `devopsRules[${params.cluster}][${params.devops}]`,
            {
              ...rules,
              _: intersection(parentActions, ['view', 'manage']),
            }
          )
        }
        break
      }
      default:
    }
  }

  @action
  checkEmail(email) {
    return request.get(
      `${this.getListUrl()}`,
      { email },
      {
        headers: { 'x-check-exist': true },
      }
    )
  }

  @action
  async update({ name, ...params }, data) {
    await this.submitting(
      request.put(this.getDetailUrl({ name, ...params }), data)
    )

    if (data.password && name === globals.user.username) {
      return await request.post('logout')
    }

    const lang = get(data, 'spec.lang')
    if (lang && data.lang !== cookie('lang')) {
      window.location.reload()
    }
  }

  @action
  async jsonPatch({ name }, data) {
    await this.submitting(
      request.patch(`apis/iam.kubesphere.io/v1alpha2/users/${name}`, data, {
        headers: {
          'content-type': 'application/json-patch+json',
        },
      })
    )
  }

  @action
  async modifyPassword({ name }, data) {
    return this.submitting(
      request.put(`${this.getDetailUrl({ name })}/password`, data)
    )
  }

  @action
  async batchDelete({ rowKeys, ...params }) {
    if (rowKeys.includes(globals.user.username)) {
      Notify.error(t('DELETING_CURRENT_USER_NOT_ALLOWED'))
    } else {
      await this.submitting(
        Promise.all(
          rowKeys.map(username =>
            request.delete(
              `${this.getDetailUrl({ name: username, ...params })}`
            )
          )
        )
      )
    }
    this.list.selectedRowKeys = []
  }

  @action
  async batchChangeStatus(type) {
    const list = this.list.data.filter(item =>
      this.list.selectedRowKeys.includes(item.name)
    )
    const requestList = []

    list.forEach(item => {
      const formtemplate = {
        apiVersion: 'iam.kubesphere.io/v1alpha2',
        kind: 'User',
        ...get(item, '_originData', {}),
      }

      set(
        formtemplate,
        'status.state',
        type === 'active' ? 'Active' : 'Disabled'
      )

      set(formtemplate, 'metadata.resourceVersion', item.resourceVersion)

      requestList.push(
        request.put(this.getDetailUrl({ ...item }), formtemplate)
      )
    })

    await this.submitting(Promise.all(requestList))
    this.list.selectedRowKeys = []
  }

  @action
  async handlechangeStatus(item) {
    const data = {
      apiVersion: 'iam.kubesphere.io/v1alpha2',
      kind: 'User',
      ...get(item, '_originData', {}),
    }

    set(data, 'status.state', item.status === 'Active' ? 'Disabled' : 'Active')
    set(data, 'metadata.resourceVersion', item.resourceVersion)
    return await this.submitting(
      request.put(this.getDetailUrl({ ...item }), data)
    )
  }

  @action
  delete(user) {
    if (user.name === globals.user.username) {
      Notify.error(t('DELETING_CURRENT_USER_NOT_ALLOWED'))
      return
    }

    return this.submitting(request.delete(`${this.getDetailUrl(user)}`))
  }

  @action
  async fetchLoginRecords({ name, ...params }) {
    this.records.isLoading = true

    if (params.limit === Infinity || params.limit === -1) {
      params.limit = -1
      params.page = 1
    }

    params.limit = params.limit || 10

    const result = await request.get(
      `kapis/iam.kubesphere.io/v1alpha2/users/${name}/loginrecords`,
      params
    )
    const data = result.items.map(ObjectMapper.default)

    this.records.update({
      data,
      total: result.totalItems || 0,
      ...params,
      limit: Number(params.limit) || 10,
      page: Number(params.page) || 1,
      isLoading: false,
    })
  }

  @action
  async confirm(data) {
    return await this.submitting(request.post(`login/confirm`, data))
  }

  @action
  async fetchGroupUser({ type, more, ...params } = {}) {
    this[type].isLoading = true
    if (!params.sortBy && params.ascending === undefined) {
      params.sortBy = 'createTime'
    }
    const result = await request.get(this.getResourceUrl(params), params)
    const data = get(result, 'items', []).map(item => ({
      ...this.mapper(item),
    }))

    this[type].update({
      data: more ? [...this[type].data, ...data] : data,
      total: result.totalItems || 0,
      ...params,
      limit: Number(params.limit) || 10,
      page: Number(params.page) || 1,
      isLoading: false,
      ...(this[type].silent ? {} : { selectedRowKeys: [] }),
    })
    return data
  }
}
