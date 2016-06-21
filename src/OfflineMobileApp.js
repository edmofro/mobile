/* @flow weak */

/**
 * OfflineMobile Android Index
 * Sustainable Solutions (NZ) Ltd. 2016
 */

import React from 'react';
import {
  Image,
  View,
} from 'react-native';

import globalStyles, { BACKGROUND_COLOR } from './globalStyles';

import { Navigator } from './navigation';

import { PAGES } from './pages';

import {
  FinaliseButton,
  FinaliseModal,
  LoginModal,
  SyncState,
} from './widgets';

import { Synchronizer } from './sync';
import { SyncAuthenticator, UserAuthenticator } from './authentication';
import { Database, schema } from './database';
import { Scheduler } from './Scheduler';
import { Settings } from './settings';

const SYNC_INTERVAL = 0.1 * 60 * 1000; // 10 minutes in milliseconds
const AUTHENTICATION_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

export default class OfflineMobileApp extends React.Component {

  constructor() {
    super();
    this.database = new Database(schema);
    this.settings = new Settings(this.database);
    this.userAuthenticator = new UserAuthenticator(this.database, this.settings);
    const syncAuthenticator = new SyncAuthenticator(this.database, this.settings);
    this.synchronizer = new Synchronizer(this.database, syncAuthenticator, this.settings);
    this.scheduler = new Scheduler();
    const initialised = this.synchronizer.isInitialised();
    this.state = {
      initialised: initialised,
      authenticated: false,
      isSyncing: false,
      syncError: '',
      lastSync: null, // Date of the last successful sync
      confirmFinalise: false,
      recordToFinalise: null,
    };
  }

  componentWillMount() {
    this.logOut = this.logOut.bind(this);
    this.onAuthentication = this.onAuthentication.bind(this);
    this.onInitialised = this.onInitialised.bind(this);
    this.renderFinaliseButton = this.renderFinaliseButton.bind(this);
    this.renderScene = this.renderScene.bind(this);
    this.renderSyncState = this.renderSyncState.bind(this);
    this.synchronize = this.synchronize.bind(this);
    this.scheduler.schedule(this.synchronize,
                            SYNC_INTERVAL);
    this.scheduler.schedule(() => this.userAuthenticator.reauthenticate(this.onAuthentication),
                            AUTHENTICATION_INTERVAL);
  }

  componentWillUnmount() {
    this.scheduler.clearAll();
  }

  onAuthentication(authenticated) {
    this.setState({ authenticated: authenticated });
  }

  onInitialised() {
    this.setState({ initialised: true });
  }

  async synchronize() {
    if (this.state.isSyncing) return; // If already syncing, skip
    try {
      this.setState({ isSyncing: true });
      await this.synchronizer.synchronize();
      this.setState({ isSyncing: false });
    } catch (error) {
      this.setState({
        isSyncing: false,
        syncError: error.message,
      });
    }
  }

  logOut() {
    this.setState({ authenticated: false });
  }

  renderFinaliseButton() {
    return (
      <FinaliseButton
        isFinalised={this.state.recordToFinalise.status === 'finalised'}
        onPress={() => this.setState({ confirmFinalise: true })}
      />);
  }

  renderLogo() {
    return (
      <Image
        resizeMode="contain"
        source={require('./images/logo.png')}
      />
    );
  }

  renderScene(props) {
    const navigateTo = (key, title, extraProps) => {
      // If the page we're going to takes in a record that can be finalised, retain it in state
      let recordToFinalise = null;
      if (extraProps && 'invoice' in extraProps) recordToFinalise = extraProps.invoice;
      else if (extraProps && 'requisition' in extraProps) recordToFinalise = extraProps.requisition;
      else if (extraProps && 'stocktake' in extraProps) recordToFinalise = extraProps.stocktake;
      this.setState({ recordToFinalise: recordToFinalise });

      // Now navigate to the page, passing on any extra props and the finalise button if required
      const navigationProps = { key, title, ...extraProps };
      if (recordToFinalise) navigationProps.renderRightComponent = this.renderFinaliseButton;
      props.onNavigate({ type: 'push', ...navigationProps });
    };
    const { key, ...extraProps } = props.scene.navigationState;
    const Page = PAGES[key]; // Get the page the navigation key relates to
    // Return the requested page with any extra props passed to navigateTo in pageProps
    return (
      <Page
        navigateTo={navigateTo}
        database={this.database}
        logOut={this.logOut}
        {...extraProps}
      />);
  }

  renderSyncState() {
    return (
      <SyncState
        isSyncing={this.state.isSyncing}
        syncError={this.state.syncError}
        settings={this.settings}
      />
    );
  }

  render() {
    if (!this.state.initialised) {
      const FirstUsePage = PAGES.firstUse;
      return (
        <FirstUsePage
          synchronizer={this.synchronizer}
          onInitialised={this.onInitialised}
        />
      );
    }
    return (
      <View style={globalStyles.appBackground}>
        <Navigator
          renderScene={this.renderScene}
          renderCentreComponent={this.renderLogo}
          renderRightComponent={this.renderSyncState}
          navBarStyle={globalStyles.navBarStyle}
          backgroundColor={BACKGROUND_COLOR}
        />
        <FinaliseModal
          database={this.database}
          isOpen={this.state.confirmFinalise}
          onClose={() => this.setState({ confirmFinalise: false })}
          record={this.state.recordToFinalise}
        />
        <LoginModal
          authenticator={this.userAuthenticator}
          isAuthenticated={this.state.authenticated}
          onAuthentication={this.onAuthentication}
        />
      </View>
    );
  }
}
