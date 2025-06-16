"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const fs = require("fs");
const os = require("os");
const path = require("path");
const openLinkInChrome = (url) => {
  const { shell } = require("electron");
  shell.openExternal(url);
};
const homeDir = os.homedir();
const documentsPath = path.join(homeDir, "Documents");
const atsMoviePath = path.join(documentsPath, "ATS_Movie");
const filePath = path.join(atsMoviePath, "user_data.json");
if (!fs.existsSync(atsMoviePath)) {
  fs.mkdirSync(atsMoviePath, { recursive: true });
}
const dataTemplate = { favorites: [], watched: [] };
const addFav = (id) => {
  try {
    if (fs.existsSync(filePath)) {
      let file = fs.readFileSync(filePath, "utf8");
      let data = JSON.parse(file);
      data.favorites.push(id);
      fs.writeFileSync(filePath, JSON.stringify(data));
      return data;
    } else {
      let data = dataTemplate;
      data.favorites.push(id);
      fs.writeFileSync(filePath, JSON.stringify(data));
      return data;
    }
  } catch (error) {
    console.log(error);
    return null;
  }
};
const delFav = (id) => {
  try {
    if (fs.existsSync(filePath)) {
      let file = fs.readFileSync(filePath, "utf8");
      let data = JSON.parse(file);
      data.favorites = data.favorites.filter((item) => item !== id);
      fs.writeFileSync(filePath, JSON.stringify(data));
      return data;
    } else {
      return true;
    }
  } catch (error) {
    console.log(error);
    return null;
  }
};
const getUserData = () => {
  try {
    if (fs.existsSync(filePath)) {
      let file = fs.readFileSync(filePath, "utf8");
      let data = JSON.parse(file);
      return data;
    } else {
      let data = dataTemplate;
      fs.writeFileSync(filePath, JSON.stringify(data));
      return data;
    }
  } catch (error) {
    console.log(error);
  }
};
const markAsWatched = (id) => {
  try {
    if (fs.existsSync(filePath)) {
      let file = fs.readFileSync(filePath, "utf8");
      let data = JSON.parse(file);
      data.watched.push(id);
      console.log(data);
      fs.writeFileSync(filePath, JSON.stringify(data));
      return data;
    } else {
      let data = dataTemplate;
      data.watched.push(id);
      fs.writeFileSync(filePath, JSON.stringify(data));
      return data;
    }
  } catch (error) {
    console.log(error);
    return null;
  }
};
const markAsUnwatched = (id) => {
  console.log(`deleting ${id}`);
  try {
    if (fs.existsSync(filePath)) {
      let file = fs.readFileSync(filePath, "utf8");
      let data = JSON.parse(file);
      data.watched = data.watched.filter((i) => i != id);
      fs.writeFileSync(filePath, JSON.stringify(data));
      return data;
    } else {
      return true;
    }
  } catch (error) {
    console.log(error);
    return null;
  }
};
const api = {
  openLinkInChrome,
  addFav,
  delFav,
  markAsUnwatched,
  markAsWatched,
  getUserData
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
