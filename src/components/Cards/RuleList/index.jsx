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

import React from 'react'

import { getBrowserLang } from 'utils'
import { get } from 'lodash'
import cookie from 'utils/cookie'

import styles from './index.scss'

export default class RuleList extends React.Component {
  render() {
    const { templates, roleCategory = [] } = this.props
    const lang = cookie('lang') || getBrowserLang()

    return (
      <ul className={styles.wrapper} data-test="rule-list">
        {Object.keys(templates).map(key => {
          const templateCategoryName = get(
            templates[key],
            `[0].labels["iam.kubesphere.io/category"]`
          )

          const categoryName = roleCategory.find(
            item => item.name === templateCategoryName
          )?.displayName?.[lang]

          return (
            <li key={key}>
              <div className={styles.name}>{categoryName}</div>
              <div>
                {templates[key]
                  .map(role =>
                    get(role, `_originData.spec.displayName[${lang}]`)
                  )
                  .join('  |  ')}
              </div>
            </li>
          )
        })}
      </ul>
    )
  }
}
