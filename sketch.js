let rainData = [];
let isLoading = true;
let myMap;
let canvas;
let hoveredWeather = null; // 記錄目前滑鼠指到的天氣狀態
const mappa = new Mappa('Leaflet');

// 地圖預設參數：以台北市為中心
const options = {
  lat: 25.0478,
  lng: 121.5319,
  zoom: 11,
  style: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

const targetUrl = 'https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D';
// 換用 corsproxy.io，這是一個目前較穩定的公共代理伺服器
const apiUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);

function fetchData() {
  loadJSON(apiUrl, (data) => {
    if (Array.isArray(data)) {
      rainData = data;
    } else if (data && data.data) {
      rainData = data.data;
    } else if (data && data.Data) {
      rainData = data.Data;
    }
    isLoading = false;
    console.log("資料已更新:", new Date().toLocaleTimeString());
  }, (error) => {
    console.error("無法取得資料:", error);
    isLoading = false;
  });
}

function setup() {
  // 建立畫布並整合至地圖
  canvas = createCanvas(windowWidth, windowHeight);
  
  // 取得初始資料
  fetchData();
  
  // 設定每 10 分鐘 (600,000 毫秒) 自動更新一次
  setInterval(fetchData, 600000);
  
  // 初始化地圖
  myMap = mappa.tileMap(options);
  myMap.overlay(canvas);

  textFont('sans-serif');
}

function draw() {
  // 清除畫布（地圖模式下必須使用 clear 而非 background，否則會遮住地圖）
  clear();
  
  // 繪製標題背景資訊欄
  fill(20, 30, 48, 200);
  noStroke();
  rect(0, 0, 400, 70);
  
  fill(255);
  textSize(20);
  textAlign(LEFT, TOP);
  text("台北市即時雨量地圖 (單位: mm)", 20, 15);
  
  if (isLoading) {
    textSize(14);
    text("資料載入中...", 20, 40);
    return;
  }

  textSize(12);
  text(`已取得 ${rainData.length} 處測站資料`, 20, 40);

  hoveredWeather = null; // 每次繪製前重置

  // 繪製各測站位置與名稱
  for (let i = 0; i < rainData.length; i++) {
    let station = rainData[i];
    
    // 取得經緯度 (確保轉換為數字，避免字串導致計算錯誤)
    let lat = parseFloat(station.lat || station.Lat || station.latitude || station.Latitude);
    let lon = parseFloat(station.lon || station.Lon || station.lng || station.Lng || station.longitude || station.Longitude);
    
    if (!isNaN(lat) && !isNaN(lon)) {
      // 將經緯度轉換為畫布上的像素座標
      let pos = myMap.latLngToPixel(lat, lon);
      
      // 可以在此處取消註解以下行來調試像素座標：
      // console.log(`Station: ${station.stationName}, Lat: ${lat}, Lon: ${lon}, PixelX: ${pos.x}, PixelY: ${pos.y}`);

      // 取得各項雨量數值
      let r10 = station.rain10min ?? station.Rain10min ?? station.rain10 ?? "0";
      let r1h = parseFloat(station.rain1hr ?? station.Rain1hr ?? station.rain1h ?? "0");
      let r24Val = parseFloat(station.rain24hr ?? station.Rain24hr ?? station.rain24h ?? "0");
      let r24 = r24Val.toString();
      
      // 特別標記參數：隨時間變動的呼吸值
      let pulse = sin(frameCount * 0.1) * 5;
      let baseSize = 12;
      let circleSize = baseSize + (r1h * 2);

      // 偵測滑鼠是否懸停在圓點上
      let d = dist(mouseX, mouseY, pos.x, pos.y);
      let isHovered = d < circleSize / 2;

      // 如果滑鼠懸停，放大圓圈尺寸
      if (isHovered) {
        circleSize *= 1.5; 
      }

      push();
      translate(pos.x, pos.y);
      
      if (r1h > 0) {
        // 1. 繪製下雨站點的外圍動態波紋
        noFill();
        stroke(255, 50, 50, 150 - pulse * 10);
        strokeWeight(2);
        ellipse(0, 0, circleSize + 15 + pulse, circleSize + 15 + pulse);

        // 2. 繪製主要圓圈（紅色）
        fill(255, 30, 30);
        stroke(isHovered ? '#FFD700' : 255); // 懸停時邊框變金色 (Gold)
        drawingContext.shadowBlur = 15;
        drawingContext.shadowColor = 'red';
      } else {
        // 無雨站點：繪製平靜的藍色標記
        fill(0, 150, 255, 200);
        stroke(isHovered ? '#FFD700' : 255); // 懸停時邊框變金色
        drawingContext.shadowBlur = 8;
        drawingContext.shadowColor = 'rgba(0, 100, 255, 0.5)';
      }
      
      strokeWeight(isHovered ? 4 : 2); // 懸停時邊框加粗
      ellipse(0, 0, circleSize, circleSize);
      pop();
      
      // 重要：手動重置發光效果，避免陰影堆疊或影響到其他繪圖元件
      drawingContext.shadowBlur = 0;

      // 使用先前算好的 isHovered 來判斷是否顯示資訊與圖示
      if (isHovered) {
        let sName = station.stationName || station.StationName || "未知";
        
        // 繪製文字背景框
        fill(0, 0, 0, 180);
        noStroke();
        rect(pos.x + 10, pos.y - 60, 150, 70, 5);
        
        // 顯示站名與詳細雨量資訊
        fill(255);
        textSize(14);
        textAlign(LEFT, TOP);
        text(`${sName}`, pos.x + 15, pos.y - 55);
        textSize(11);
        text(`10m: ${r10} mm\n1h: ${r1h} mm\n24h: ${r24} mm`, pos.x + 15, pos.y - 38);

        // 判斷天氣圖示
        if (r1h > 0) hoveredWeather = 'rainy';
        else if (r24Val > 0) hoveredWeather = 'cloudy';
        else hoveredWeather = 'sunny';
      }
    }
  }

  // 如果有懸停，在右上方顯示大圖示
  if (hoveredWeather) {
    drawWeatherIcon(hoveredWeather, width - 80, 80);
  }

  // 繪製右下角圖例
  drawLegend();
}

// 繪製雨量圖例的輔助函式
function drawLegend() {
  let legendX = width - 200;
  let legendY = height - 100;
  
  push();
  // 面板背景
  fill(20, 30, 48, 200);
  noStroke();
  rect(legendX - 10, legendY - 10, 190, 85, 8);

  // 1. 正在下雨示例 (帶波紋動畫)
  let pulse = sin(frameCount * 0.1) * 3;
  noFill();
  stroke(255, 50, 50, 150 - pulse * 10);
  strokeWeight(2);
  ellipse(legendX + 15, legendY + 20, 15 + pulse, 15 + pulse);
  fill(255, 30, 30);
  stroke(255);
  strokeWeight(1);
  ellipse(legendX + 15, legendY + 20, 10, 10);
  
  fill(255);
  noStroke();
  textSize(13);
  textAlign(LEFT, CENTER);
  text("正在下雨 (>0 mm/hr)", legendX + 35, legendY + 20);

  // 2. 目前無雨示例
  fill(0, 150, 255, 200);
  stroke(255);
  strokeWeight(1);
  ellipse(legendX + 15, legendY + 55, 10, 10);
  
  fill(255);
  noStroke();
  text("目前無雨 (0 mm/hr)", legendX + 35, legendY + 55);
  pop();
}

// 繪製天氣圖示的輔助函式
function drawWeatherIcon(type, x, y) {
  push();
  translate(x, y);
  noStroke();
  if (type === 'sunny') {
    // 太陽
    fill(255, 230, 0);
    ellipse(0, 0, 50, 50);
    stroke(255, 230, 0);
    strokeWeight(4);
    for (let a = 0; a < TWO_PI; a += PI / 4) {
      line(cos(a) * 30, sin(a) * 30, cos(a) * 45, sin(a) * 45);
    }
  } else if (type === 'cloudy') {
    // 陰天雲朵
    fill(200, 200, 210);
    ellipse(-15, 10, 40, 40);
    ellipse(15, 10, 40, 40);
    ellipse(0, -5, 50, 50);
  } else if (type === 'rainy') {
    // 雨雲
    fill(100, 110, 130);
    ellipse(-15, 0, 40, 40);
    ellipse(15, 0, 40, 40);
    ellipse(0, -15, 50, 50);
    // 雨滴
    stroke(0, 180, 255);
    strokeWeight(3);
    for (let i = -20; i <= 20; i += 20) {
      line(i, 20, i - 5, 40);
    }
  }
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
