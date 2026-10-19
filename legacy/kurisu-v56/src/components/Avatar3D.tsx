/**
 * Override Avatar System: 2D Dynamic Avatar for Makise Kurisu.
 * Replaces previous 3D model with 2D Live Canvas & Vector Sprite Avatar System.
 * Derived directly from the 4 Canonical Reference Images (32 expressions).
 */

import React from 'react';
import { Avatar2D } from './Avatar2D';
import { AvatarExpression, AvatarSettings } from '../types';

interface Avatar3DProps {
  expression: AvatarExpression;
  isSpeaking: boolean;
  avatarSettings: AvatarSettings;
  onAvatarClick?: () => void;
  onTouchBodyPart?: (part: 'head' | 'face' | 'coat' | 'hand', partLabel: string) => void;
  trustLevel?: number;
  onSelectExpression?: (expr: AvatarExpression) => void;
}

export const Avatar3D: React.FC<Avatar3DProps> = (props) => {
  return <Avatar2D {...props} />;
};
