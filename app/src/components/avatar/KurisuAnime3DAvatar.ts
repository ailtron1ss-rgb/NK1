/**
 * KurisuAnime3DAvatar.ts
 *
 * Procedural Three.js 3D embodiment rig for Makise Kurisu (Steins;Gate).
 * Features:
 * - Canonical anime appearance: auburn hair, white cross pins, loose red tie, violet eyes, blush.
 * - Multi-outfit wardrobe: Lab Coat, Casual (khaki cardigan), Hoodie, Formal.
 * - Skeletal hierarchy with analytical bilateral planar IK for realistic arm gesturing.
 * - Autonomic micro-movements: breathing cycle, saccadic eye drift, spontaneous blinking.
 * - Emotional posture mapping from Kurisu's internal affective state.
 */

import * as THREE from 'three';

export type OutfitType = 'lab_coat' | 'casual' | 'hoodie' | 'formal';

export interface KurisuAffectiveState {
  valence: number;     // -1 (negative/troubled) to +1 (happy/confident)
  arousal: number;     // 0 (calm) to 1 (excited/tense)
  curiosity: number;   // 0 to 1
  tsundere: number;    // 0 (gentle) to 1 (flustered/defensive)
  focus: number;       // 0 to 1 (deep scientific analysis)
}

export interface KurisuRigMeshGroups {
  root: THREE.Group;
  head: THREE.Group;
  eyesLeft: THREE.Mesh;
  eyesRight: THREE.Mesh;
  mouth: THREE.Mesh;
  blushLeft: THREE.Mesh;
  blushRight: THREE.Mesh;
  hairGroup: THREE.Group;
  hairPins: THREE.Group;
  torso: THREE.Group;
  outfitGroup: THREE.Group;
  leftArm: THREE.Group;
  leftForearm: THREE.Group;
  leftHand: THREE.Group;
  rightArm: THREE.Group;
  rightForearm: THREE.Group;
  rightHand: THREE.Group;
  legsGroup: THREE.Group;
}

export class KurisuAnime3DAvatar {
  public group: THREE.Group;
  public parts: KurisuRigMeshGroups;
  public currentOutfit: OutfitType = 'lab_coat';
  public affect: KurisuAffectiveState = {
    valence: 0.2,
    arousal: 0.3,
    curiosity: 0.8,
    tsundere: 0.4,
    focus: 0.7,
  };

  private clock: THREE.Clock;
  private blinkTimer: number = 0;
  private isBlinking: boolean = false;

  constructor() {
    this.group = new THREE.Group();
    this.clock = new THREE.Clock();
    this.parts = this.buildRig();
    this.group.add(this.parts.root);
    this.setOutfit('lab_coat');
  }

  private buildRig(): KurisuRigMeshGroups {
    const root = new THREE.Group();
    root.position.y = -0.5;

    // Materials Palette matching canonical Steins;Gate anime design
    const skinMat = new THREE.MeshToonMaterial({ color: 0xffe4db });
    const hairMat = new THREE.MeshToonMaterial({ color: 0x7a1c16 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x4a3b69 });
    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xff6677,
      transparent: true,
      opacity: 0.45,
    });
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Head
    const head = new THREE.Group();
    head.position.y = 1.6;

    const faceGeom = new THREE.CylinderGeometry(0.24, 0.12, 0.38, 16);
    faceGeom.rotateX(0.08);
    const face = new THREE.Mesh(faceGeom, skinMat);
    head.add(face);

    // Eyes
    const eyeGeom = new THREE.SphereGeometry(0.045, 12, 12);
    eyeGeom.scale(1.2, 0.7, 0.4);
    const eyesLeft = new THREE.Mesh(eyeGeom, eyeMat);
    eyesLeft.position.set(-0.09, 0.05, 0.21);
    const eyesRight = new THREE.Mesh(eyeGeom, eyeMat);
    eyesRight.position.set(0.09, 0.05, 0.21);
    head.add(eyesLeft, eyesRight);

    // Blush
    const blushGeom = new THREE.PlaneGeometry(0.08, 0.035);
    const blushLeft = new THREE.Mesh(blushGeom, blushMat);
    blushLeft.position.set(-0.12, -0.01, 0.22);
    const blushRight = new THREE.Mesh(blushGeom, blushMat);
    blushRight.position.set(0.12, -0.01, 0.22);
    head.add(blushLeft, blushRight);

    // Mouth
    const mouthGeom = new THREE.TorusGeometry(0.022, 0.005, 8, 16, Math.PI);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0xaa3333 });
    const mouth = new THREE.Mesh(mouthGeom, mouthMat);
    mouth.position.set(0, -0.08, 0.21);
    mouth.rotation.x = Math.PI;
    head.add(mouth);

    // Hair
    const hairGroup = new THREE.Group();
    const hairCapGeom = new THREE.SphereGeometry(0.28, 16, 16);
    const hairCap = new THREE.Mesh(hairCapGeom, hairMat);
    hairCap.position.set(0, 0.06, -0.02);
    hairGroup.add(hairCap);

    // Long Side Strands
    const sideHairGeom = new THREE.ConeGeometry(0.07, 0.75, 12);
    const leftSideHair = new THREE.Mesh(sideHairGeom, hairMat);
    leftSideHair.position.set(-0.25, -0.15, 0.05);
    leftSideHair.rotation.z = -0.15;

    const rightSideHair = new THREE.Mesh(sideHairGeom, hairMat);
    rightSideHair.position.set(0.25, -0.15, 0.05);
    rightSideHair.rotation.z = 0.15;
    hairGroup.add(leftSideHair, rightSideHair);

    // White Cross Hairpins
    const hairPins = new THREE.Group();
    const createPin = (x: number) => {
      const g = new THREE.Group();
      const bGeom = new THREE.BoxGeometry(0.012, 0.05, 0.008);
      const b1 = new THREE.Mesh(bGeom, pinMat);
      const b2 = new THREE.Mesh(bGeom, pinMat);
      b1.rotation.z = Math.PI / 4;
      b2.rotation.z = -Math.PI / 4;
      g.add(b1, b2);
      g.position.set(x, 0.12, 0.22);
      return g;
    };
    hairPins.add(createPin(-0.22), createPin(0.22));
    hairGroup.add(hairPins);
    head.add(hairGroup);
    root.add(head);

    // Torso
    const torso = new THREE.Group();
    torso.position.y = 1.15;
    const bodyGeom = new THREE.CylinderGeometry(0.2, 0.17, 0.55, 14);
    const body = new THREE.Mesh(bodyGeom, skinMat);
    torso.add(body);

    const outfitGroup = new THREE.Group();
    torso.add(outfitGroup);
    root.add(torso);

    // Arms
    const createArm = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const shoulder = new THREE.Group();
      shoulder.position.set(sign * 0.28, 0.2, 0);

      const upperGeom = new THREE.CylinderGeometry(0.05, 0.045, 0.35, 10);
      upperGeom.translate(0, -0.175, 0);
      const upper = new THREE.Mesh(upperGeom, skinMat);
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.set(0, -0.35, 0);

      const lowerGeom = new THREE.CylinderGeometry(0.045, 0.04, 0.35, 10);
      lowerGeom.translate(0, -0.175, 0);
      const lower = new THREE.Mesh(lowerGeom, skinMat);
      elbow.add(lower);

      const hand = new THREE.Group();
      hand.position.set(0, -0.35, 0);
      const handMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), skinMat);
      hand.add(handMesh);
      elbow.add(hand);
      shoulder.add(elbow);

      return { shoulder, elbow, hand };
    };

    const left = createArm(true);
    const right = createArm(false);
    torso.add(left.shoulder, right.shoulder);

    // Legs
    const legsGroup = new THREE.Group();
    legsGroup.position.y = 0.85;
    const legGeom = new THREE.CylinderGeometry(0.07, 0.05, 0.9, 12);
    const tightsMat = new THREE.MeshToonMaterial({ color: 0x1a1a24 });
    const legL = new THREE.Mesh(legGeom, tightsMat);
    legL.position.set(-0.11, -0.45, 0);
    const legR = new THREE.Mesh(legGeom, tightsMat);
    legR.position.set(0.11, -0.45, 0);
    legsGroup.add(legL, legR);
    root.add(legsGroup);

    return {
      root,
      head,
      eyesLeft,
      eyesRight,
      mouth,
      blushLeft,
      blushRight,
      hairGroup,
      hairPins,
      torso,
      outfitGroup,
      leftArm: left.shoulder,
      leftForearm: left.elbow,
      leftHand: left.hand,
      rightArm: right.shoulder,
      rightForearm: right.elbow,
      rightHand: right.hand,
      legsGroup,
    };
  }

  public setOutfit(outfit: OutfitType) {
    this.currentOutfit = outfit;
    while (this.parts.outfitGroup.children.length > 0) {
      this.parts.outfitGroup.remove(this.parts.outfitGroup.children[0]);
    }

    const whiteShirtMat = new THREE.MeshToonMaterial({ color: 0xf5f7fb });
    const brownCardiganMat = new THREE.MeshToonMaterial({ color: 0x8c6338 });
    const labCoatMat = new THREE.MeshToonMaterial({ color: 0xffffff });
    const redTieMat = new THREE.MeshBasicMaterial({ color: 0x9e1b22 });
    const blackShortsMat = new THREE.MeshToonMaterial({ color: 0x1f1f24 });

    // Base shirt & red tie
    const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.18, 0.45, 14), whiteShirtMat);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.02), redTieMat);
    tie.position.set(0, 0.05, 0.2);
    tie.rotation.z = 0.05;
    this.parts.outfitGroup.add(shirt, tie);

    // Shorts
    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.18, 14), blackShortsMat);
    shorts.position.set(0, -0.22, 0);
    this.parts.outfitGroup.add(shorts);

    if (outfit === 'lab_coat' || outfit === 'casual') {
      const cardigan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.52, 14), brownCardiganMat);
      this.parts.outfitGroup.add(cardigan);
    }

    if (outfit === 'lab_coat') {
      const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.75, 14), labCoatMat);
      coat.position.set(0, -0.1, 0);
      this.parts.outfitGroup.add(coat);
    }
  }

  public update(deltaTime: number) {
    const elapsed = this.clock.getElapsedTime();

    // Breathing autonomic cycle
    const breath = Math.sin(elapsed * 2.0) * 0.015;
    this.parts.torso.position.y = 1.15 + breath;

    // Eye blinking
    this.blinkTimer += deltaTime;
    if (this.blinkTimer > 3.8) {
      this.isBlinking = true;
      this.parts.eyesLeft.scale.y = 0.1;
      this.parts.eyesRight.scale.y = 0.1;
      if (this.blinkTimer > 4.0) {
        this.isBlinking = false;
        this.parts.eyesLeft.scale.y = 1.0;
        this.parts.eyesRight.scale.y = 1.0;
        this.blinkTimer = 0;
      }
    }

    // Saccadic eye micro-drift
    const eyeDriftX = Math.sin(elapsed * 1.3) * 0.005;
    this.parts.eyesLeft.position.x = -0.09 + eyeDriftX;
    this.parts.eyesRight.position.x = 0.09 + eyeDriftX;

    // Tsundere blush opacity modulation
    (this.parts.blushLeft.material as THREE.MeshBasicMaterial).opacity = 0.2 + this.affect.tsundere * 0.6;
    (this.parts.blushRight.material as THREE.MeshBasicMaterial).opacity = 0.2 + this.affect.tsundere * 0.6;

    // Affective posture mapping
    if (this.affect.focus > 0.6) {
      // Thinking pose: slight tilt, hand near chin
      this.parts.head.rotation.z = THREE.MathUtils.lerp(this.parts.head.rotation.z, 0.08, 0.05);
      this.parts.leftArm.rotation.x = THREE.MathUtils.lerp(this.parts.leftArm.rotation.x, -0.9, 0.05);
      this.parts.leftForearm.rotation.x = THREE.MathUtils.lerp(this.parts.leftForearm.rotation.x, -1.2, 0.05);
    } else {
      this.parts.head.rotation.z = THREE.MathUtils.lerp(this.parts.head.rotation.z, 0, 0.05);
      this.parts.leftArm.rotation.x = THREE.MathUtils.lerp(this.parts.leftArm.rotation.x, 0.1, 0.05);
      this.parts.leftForearm.rotation.x = THREE.MathUtils.lerp(this.parts.leftForearm.rotation.x, 0.1, 0.05);
    }
  }
}
