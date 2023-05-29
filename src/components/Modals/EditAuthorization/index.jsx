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

import { get, keyBy, groupBy, sortBy, uniq } from 'lodash'
import React from 'react'
import classNames from 'classnames'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'

import { Modal, Text, Indicator } from 'components/Base'
import { getBrowserLang } from 'utils'
import CheckItem from './CheckItem'
import { ROLE_MODULES_ICON } from './constants'
import styles from './index.scss'

@observer
export default class EditAuthorizationModal extends React.Component {
  static propTypes = {
    roleTemplates: PropTypes.array,
    formTemplate: PropTypes.object,
    visible: PropTypes.bool,
    onOk: PropTypes.func,
    onCancel: PropTypes.func,
    isSubmitting: PropTypes.bool,
  }

  static defaultProps = {
    visible: false,
    isSubmitting: false,
    onOk() {},
    onCancel() {},
  }

  constructor(props) {
    super(props)

    const roleTemplatesMap = keyBy(this.props.roleTemplates, 'name')
    const roleTemplates = get(
      this.props.formTemplate,
      'aggregationRoleTemplates.templateNames',
      []
    )

    const roleModulesLists = this.props.roleModules?.map(item => {
      return {
        ...item,
        icon: ROLE_MODULES_ICON[item.name] || 'templet',
        state: roleTemplates.some(name => {
          return (
            get(
              roleTemplatesMap[name],
              'labels["iam.kubesphere.io/category"]'
            ) === item.name
          )
        })
          ? 'ENABLED'
          : 'NOT_ENABLED',
      }
    })

    const groupedTemplates = groupBy(
      this.props.roleTemplates,
      'labels["iam.kubesphere.io/category"]'
    )

    this.state = {
      roleTemplates,
      roleModules: roleModulesLists,
      roleTemplatesMap,
      currentModule:
        roleModulesLists && roleModulesLists.length > 0
          ? roleModulesLists[0].name
          : '',
      groupedTemplates,
    }
  }

  handleOk = () => {
    this.props.onOk(uniq([...this.state.roleTemplates]))
  }

  handleTabChange = e => {
    const module = e.currentTarget.dataset.module
    this.setState({ currentModule: module })
  }

  handleCheckChange = roleTemplates => {
    const { currentModule, roleModules, groupedTemplates } = this.state

    const roleModule = roleModules.find(item => item.name === currentModule)
    if (roleModule) {
      roleModule.state = groupedTemplates[currentModule].some(item =>
        roleTemplates.includes(item.name)
      )
        ? 'ENABLED'
        : 'NOT_ENABLED'
    }

    this.setState({ roleTemplates })
  }

  renderTabs() {
    const { roleModules, currentModule } = this.state
    const lang = get(globals.user, 'lang') || getBrowserLang()

    return (
      <div className={styles.tabs}>
        <div className={styles.title}>{t('CATEGORIES')}</div>
        <div className={styles.tabsWrapper}>
          {roleModules.map(item => (
            <div
              key={item.name}
              className={classNames(styles.tab, {
                [styles.enabled]: currentModule === item.name,
              })}
              onClick={this.handleTabChange}
              data-module={item.name}
            >
              <Text
                icon={item.icon}
                title={item.displayName[lang] || item.displayName.en}
                description={
                  currentModule === item.name
                    ? t('CURRENT')
                    : item.state === 'ENABLED'
                    ? t('AUTHORIZED')
                    : t('UNAUTHORIZED')
                }
              />
              <Indicator
                className={styles.indicator}
                type={item.state === 'ENABLED' ? 'running' : 'disabled'}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  renderContent() {
    const {
      groupedTemplates,
      roleTemplates,
      roleTemplatesMap,
      currentModule,
    } = this.state
    const templates = sortBy(groupedTemplates[currentModule] || [], 'name')

    return (
      <div className={styles.content}>
        <div className={styles.title}>{t('PERMISSION_PL')}</div>
        <div className={styles.contentWrapper}>
          {templates.map(item => (
            <CheckItem
              key={item.name}
              data={item}
              roleTemplates={roleTemplates}
              roleTemplatesMap={roleTemplatesMap}
              onChange={this.handleCheckChange}
            />
          ))}
        </div>
      </div>
    )
  }

  render() {
    const { title, visible, onCancel, isSubmitting } = this.props

    return (
      <Modal
        title={title || t('EDIT_PERMISSIONS')}
        icon="role"
        onCancel={onCancel}
        onOk={this.handleOk}
        visible={visible}
        isSubmitting={isSubmitting}
        fullScreen
      >
        <div className={styles.wrapper}>
          {this.renderTabs()}
          {this.renderContent()}
        </div>
      </Modal>
    )
  }
}
