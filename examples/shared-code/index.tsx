#!/usr/bin/env node
import { AppRegistry } from 'react-native';
import { Greeting } from './Greeting.js';

AppRegistry.registerComponent('shared', () => Greeting);
AppRegistry.runApplication('shared', { initialProps: { name: 'there' } });
