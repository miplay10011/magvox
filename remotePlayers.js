import * as THREE from 'three';
import { scene } from './render.js';
import { PLAYER } from './player.js';
import { spawnParticles } from './effects.js';

export let remotePlayers = new Map();

export function createPlayerModel(color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
  const legGeo = new THREE.BoxGeometry(0.3, 0.6, 0.3);
  const leftLeg = new THREE.Mesh(legGeo, mat);
  leftLeg.name = 'leftLeg';
  leftLeg.position.set(-0.2, 0.3, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, mat);
  rightLeg.name = 'rightLeg';
  rightLeg.position.set(0.2, 0.3, 0);
  group.add(rightLeg);
  const torsoGeo = new THREE.BoxGeometry(0.6, 0.8, 0.3);
  const torso = new THREE.Mesh(torsoGeo, mat);
  torso.position.set(0, 1, 0);
  group.add(torso);
  const armGeo = new THREE.BoxGeometry(0.3, 0.6, 0.3);
  const leftArm = new THREE.Mesh(armGeo, mat);
  leftArm.name = 'leftArm';
  leftArm.position.set(-0.45, 1.1, 0);
  group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, mat);
  rightArm.name = 'rightArm';
  rightArm.position.set(0.45, 1.1, 0);
  group.add(rightArm);
  const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.set(0, 1.6, 0);
  group.add(head);
  const hitboxGeo = new THREE.BoxGeometry(PLAYER.width, PLAYER.height, PLAYER.width);
  const hitboxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, visible: true });
  const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
  hitbox.position.set(0, PLAYER.height / 2, 0);
  group.add(hitbox);
  group.userData = { leftArm, rightArm, leftLeg, rightLeg };
  return group;
}

export function flashPlayerModel(group, duration = 200) {
  if (!group) return;
  group.children.forEach(child => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => {
          if (!mat.userData.originalColor) mat.userData.originalColor = mat.color.clone();
          mat.color.setHex(0xff0000);
        });
      } else {
        if (!child.material.userData.originalColor) child.material.userData.originalColor = child.material.color.clone();
        child.material.color.setHex(0xff0000);
      }
    }
  });
  if (group._flashTimer) clearTimeout(group._flashTimer);
  group._flashTimer = setTimeout(() => {
    group.children.forEach(child => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            if (mat.userData.originalColor) mat.color.copy(mat.userData.originalColor);
          });
        } else {
          if (child.material.userData.originalColor) child.material.color.copy(child.material.userData.originalColor);
        }
      }
    });
    group._flashTimer = null;
  }, duration);
}

export function addRemotePlayer(id, p) {
  if (remotePlayers.has(id)) return;
  const hue = (id * 0.61) % 1;
  const color = new THREE.Color().setHSL(hue, 0.7, 0.5);
  const group = createPlayerModel(color);
  group.position.set(p.x, p.y, p.z);
  scene.add(group);
  remotePlayers.set(id, {
    group,
    target: new THREE.Vector3(p.x, p.y, p.z),
    yaw: p.yaw || 0,
    nickname: p.nickname || `Player ${id}`,
    lastPos: new THREE.Vector3(p.x, p.y, p.z),
    phase: 0,
  });
}

export function removeRemotePlayer(id) {
  const rp = remotePlayers.get(id);
  if (!rp) return;
  scene.remove(rp.group);
  remotePlayers.delete(id);
}

export function updateRemotePlayers(dt) {
  const k = 1 - Math.pow(0.0001, dt);
  const tmp = new THREE.Vector3();
  for (const rp of remotePlayers.values()) {
    tmp.set(rp.target.x, rp.target.y, rp.target.z);
    rp.group.position.lerp(tmp, k);
    rp.group.rotation.y += (rp.yaw - rp.group.rotation.y) * k;
    const dx = rp.group.position.x - rp.lastPos.x;
    const dz = rp.group.position.z - rp.lastPos.z;
    const speed = Math.hypot(dx, dz);
    const animSpeed = 12.0;
    const armAmp = 0.8;
    const legAmp = 0.5;
    if (speed > 0.01) rp.phase += speed * animSpeed;
    else rp.phase *= 0.95;
    const leftArm = rp.group.userData.leftArm;
    const rightArm = rp.group.userData.rightArm;
    const leftLeg = rp.group.userData.leftLeg;
    const rightLeg = rp.group.userData.rightLeg;
    if (leftArm && rightArm && leftLeg && rightLeg) {
      const angle = Math.sin(rp.phase) * armAmp;
      leftArm.rotation.x = angle;
      rightArm.rotation.x = -angle;
      const legAngle = Math.sin(rp.phase) * legAmp;
      leftLeg.rotation.x = -legAngle;
      rightLeg.rotation.x = legAngle;
    }
    rp.lastPos.copy(rp.group.position);
  }
}