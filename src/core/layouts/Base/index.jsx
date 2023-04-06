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

import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { inject, observer } from 'mobx-react'
import { renderRoutes } from 'utils/router.config'

import styles from './index.scss'

@inject('rootStore')
@observer
class BaseLayout extends Component {
  static propTypes = {
    children: PropTypes.node,
    location: PropTypes.object,
  }

  constructor(props) {
    super(props)

    this.navRef = React.createRef()
    this.headerRef = React.createRef()

    this.routes = props.route.routes
  }

  get showKubeControl() {
    return globals.app.isClusterAdmin
  }

  handleClick = e => {
    if (this.navRef.current && !this.navRef.current.contains(e.target)) {
      this.props.rootStore.hideGlobalNav()
      document.removeEventListener('click', this.handleClick)
    }
  }

  handleJumpTo = link => {
    this.props.rootStore.routing.push(link)
  }

  render() {
    return <div className={styles.main}>{renderRoutes(this.routes)}</div>
  }
}

export default BaseLayout
