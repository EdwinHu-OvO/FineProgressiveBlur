// macOS only. Run with an optimized build; see docs/apple-blur-research.md.
// Measures warm, repeated GPU work on pre-uploaded textures, not UI frame cost.
import Foundation
import Metal
import MetalPerformanceShaders

let device = MTLCreateSystemDefaultDevice()!
let queue = device.makeCommandQueue()!
let repetitions = 32
let batches = 9

func texture(_ width: Int, _ height: Int, storage: MTLStorageMode) -> MTLTexture {
  let descriptor = MTLTextureDescriptor.texture2DDescriptor(
    pixelFormat: .rgba8Unorm, width: width, height: height, mipmapped: false)
  descriptor.storageMode = storage
  descriptor.usage = [.shaderRead, .shaderWrite]
  return device.makeTexture(descriptor: descriptor)!
}

func completed(_ buffer: MTLCommandBuffer) {
  buffer.commit()
  buffer.waitUntilCompleted()
  precondition(buffer.status == .completed, String(describing: buffer.error))
}

for dpr in [1, 2] {
  let width = 802 * dpr
  let height = 632 * dpr
  let staging = texture(width, height, storage: .shared)
  let source = texture(width, height, storage: .private)
  let output = texture(width, height, storage: .private)
  var pixels = [UInt8](repeating: 255, count: width * height * 4)
  for y in 0..<height {
    for x in 0..<width {
      let i = (y * width + x) * 4
      pixels[i] = UInt8((x * 197 + y * 113) % 256)
      pixels[i + 1] = UInt8(x < width / 2 ? 0 : 255)
      pixels[i + 2] = UInt8((y / 16) % 2 == 0 ? 40 : 220)
    }
  }
  pixels.withUnsafeBytes { pointer in
    staging.replace(
      region: MTLRegionMake2D(0, 0, width, height), mipmapLevel: 0, withBytes: pointer.baseAddress!,
      bytesPerRow: width * 4)
  }
  let upload = queue.makeCommandBuffer()!
  let copy = upload.makeBlitCommandEncoder()!
  copy.copy(from: staging, to: source)
  copy.endEncoding()
  completed(upload)
  for radius in [0, 1, 4, 12, 28, 48] {
    let blur = MPSImageGaussianBlur(device: device, sigma: Float(max(1, radius) * dpr))
    blur.edgeMode = .clamp
    func encode(_ commandBuffer: MTLCommandBuffer, count: Int) {
      if radius == 0 {
        let blit = commandBuffer.makeBlitCommandEncoder()!
        for _ in 0..<count { blit.copy(from: source, to: output) }
        blit.endEncoding()
      } else {
        for _ in 0..<count {
          blur.encode(
            commandBuffer: commandBuffer, sourceTexture: source, destinationTexture: output)
        }
      }
    }
    let warmup = queue.makeCommandBuffer()!
    encode(warmup, count: 16)
    completed(warmup)
    var gpuTimes = [Double]()
    for _ in 0..<batches {
      let commandBuffer = queue.makeCommandBuffer()!
      encode(commandBuffer, count: repetitions)
      completed(commandBuffer)
      gpuTimes.append(
        (commandBuffer.gpuEndTime - commandBuffer.gpuStartTime) * 1000 / Double(repetitions))
    }
    // Validate the green step edge after timing, using a separate readback.
    let validation = queue.makeCommandBuffer()!
    let readback = validation.makeBlitCommandEncoder()!
    readback.copy(from: output, to: staging)
    readback.endEncoding()
    completed(validation)
    var edgePixel = [UInt8](repeating: 0, count: 4)
    edgePixel.withUnsafeMutableBytes { pointer in
      staging.getBytes(
        pointer.baseAddress!, bytesPerRow: 4, from: MTLRegionMake2D(width / 2, height / 2, 1, 1),
        mipmapLevel: 0)
    }
    precondition(edgePixel[3] == 255)
    precondition(radius == 0 ? edgePixel[1] == 255 : (120...190).contains(edgePixel[1]))
    gpuTimes.sort()
    let report: [String: Any] = [
      "gpu": device.name, "width": width, "height": height, "dpr": dpr, "cssSigma": radius,
      "operation": radius == 0 ? "copy" : "MPSImageGaussianBlur",
      "medianGpuMs": gpuTimes[batches / 2], "minGpuMs": gpuTimes[0], "maxGpuMs": gpuTimes.last!,
      "repetitions": repetitions, "batches": batches,
    ]
    print(
      String(
        data: try! JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]),
        encoding: .utf8)!)
  }
}
