#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { AppRegistry } from '@weifxn/react-native-ink';
import { App } from './App.js';

const { values } = parseArgs({ options: { name: { type: 'string' } } });

AppRegistry.registerComponent('hello', () => App);
AppRegistry.runApplication('hello', { initialProps: values });
