#!/usr/bin/env node
import { AppRegistry } from '@weifxn/react-native-ink';
import { App } from './App.js';

AppRegistry.registerComponent('dashboard', () => App);
AppRegistry.runApplication('dashboard');
