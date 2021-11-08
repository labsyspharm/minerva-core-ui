import {
  toVec3, toVec1
} from './hashUtil'

// Types
import type {
  Vec3, Vec1
} from "./hashUtil"

export type Waypoint = {
  name: string,
  g: Vec1,
  v: Vec3 
}

export type Story = {
  waypoints: Waypoint[]
}

export type Group = {
  name: string,
  path: string
}

export interface Exhibit {
  stories: Story[],
  groups: Group[]
}

export interface Config {
  Groups?: {
    Name: string,
    Path: string
  }[],
  Stories?: {
    Waypoints: {
      Name: string,
      Group: string,
      Zoom: number, 
      Pan: number[]
    }[]
  }[]
}

const readStories = (config: Config): Story[] => {
  const stories = config.Stories || [];
  const groups = config.Groups || [];
  const groupNames = groups.map((group) => {
    return group.Name;
  });
  const indexGroupName = (name) => {
    return groupNames.indexOf(name)
  }

  return stories.map((story) => {
    return {
      waypoints: story.Waypoints.map((waypoint) => {
        const [x, y] = waypoint.Pan.slice(0, 2)
        return {
          name: waypoint.Name,
          g: toVec1(indexGroupName(waypoint.Group)),
          v: toVec3([ waypoint.Zoom, x, y ], 4)
        }
      })
    }
  })
}

const readGroups = (config: Config): Group[] => {
  const groups = config.Groups || [];
  return groups.map((group) => {
    return {
      name: group.Name,
      path: group.Path
    }
  })
}

const readConfig = (config: Config): Exhibit => {
  return {
    stories: readStories(config),
    groups: readGroups(config)
  }
}

export {
  readConfig
}
