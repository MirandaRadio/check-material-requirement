
const ffmpeg = require("fluent-ffmpeg")
const Decimal = require('decimal.js');

async function getMaterialMetadata(filePath = '') {
  const response = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) { throw error }
      resolve(metadata)
    });
  })

  const findMain = response.streams.find(x => x.codec_type == 'video')
  if(!findMain){ throw new Error('No se ha encontrado información del video.') }

  const findAudio = response.streams.find(x => x.codec_type == 'audio') || {}
  const [fps, speed] = String(findMain.avg_frame_rate || '').split('/')
  return { 
    status: true,
    data: {
      duration: response.format.duration,
      size: response.format.size,
      width: findMain.width,
      height: findMain.height,
      aspect_ratio: getAspectRatio(findMain.width, findMain.height),
      frame_rate: (Number(fps || 0) / Number(speed || 1)).toFixed(0),
      bit_rate: parseNum((findMain.bit_rate / 1000000), 2),
      codec_video: String(findMain.codec_name || '').trim().toLowerCase(),
      coded_audio: String(findAudio.codec_name || '').trim().toLowerCase()
    }
  }
}

function parseNum (number, decimalPlaces) {
  decimalPlaces = decimalPlaces === undefined ? 2 : decimalPlaces

  const num = new Decimal(Number(number || 0).toFixed(5))
  return num.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).toNumber()
}

function isAspectRatioInRange(width, height, ratio1, ratio2) {
  console.log('isAspectRatioInRange', width, height, ratio1, ratio2);
  // Asegurarse de que los parámetros sean números positivos
  width = Math.abs(Math.round(width));
  height = Math.abs(Math.round(height));
  
  // Evitar división por cero
  if (width === 0 || height === 0) {
    return false;
  }
  
  // Calcular el aspect ratio de la imagen como decimal
  const imageRatio = parseNum(width / height);
  
  // Convertir los aspect ratios de entrada a decimales
  let minRatio, maxRatio;
  
  // Procesar ratio1
  if (typeof ratio1 === 'string') {
    const [num1, den1] = ratio1.split(':').map(Number);
    minRatio = num1 / den1;
  } else {
    minRatio = ratio1;
  }
  
  // Procesar ratio2
  if (typeof ratio2 === 'string') {
    const [num2, den2] = ratio2.split(':').map(Number);
    maxRatio = num2 / den2;
  } else {
    maxRatio = ratio2;
  }
  
  // Asegurarse de que minRatio sea menor que maxRatio
  const min = parseNum(Math.min(minRatio, maxRatio), 2);
  const max = parseNum(Math.max(minRatio, maxRatio), 2);
  
  // Verificar si el aspect ratio de la imagen está en el rango
  return imageRatio >= min && imageRatio <= max;
}

function getAspectRatio(width, height) {
  function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b); // Algoritmo de Euclides para calcular el MCD
  }

  const divisor = gcd(width, height);
  let aspectRatioWidth = width / divisor;
  let aspectRatioHeight = height / divisor;

  // Calcular la relación de aspecto decimal
  const decimalAspectRatio = (width / height).toFixed(2);

  // Lista de relaciones de aspecto comunes con su valor decimal
  const commonRatios = {
    "1:1": 1.0,
    "4:5": (4 / 5).toFixed(2),
    "5:4": (5 / 4).toFixed(2),
    "16:9": (16 / 9).toFixed(2),
    "9:16": (9 / 16).toFixed(2),
    "3:2": (3 / 2).toFixed(2),
    "2:3": (2 / 3).toFixed(2),
    "1.91:1": 1.91 // Usado en Facebook e Instagram
  };

  // Buscar la relación de aspecto más cercana
  let closestRatio = `${aspectRatioWidth}:${aspectRatioHeight}`;
  let closestDifference = Math.abs(decimalAspectRatio - (aspectRatioWidth / aspectRatioHeight));

  for (const [ratio, value] of Object.entries(commonRatios)) {
    const diff = Math.abs(decimalAspectRatio - value);
    if (diff < closestDifference) {
      closestRatio = ratio;
      closestDifference = diff;
    }
  }

  return closestRatio;
}

module.exports = {
   getMaterialMetadata, 
   parseNum, 
   isAspectRatioInRange 
};
