// Test for TikTok Get User Posts
import Tiktok from "../src/index"

async function testUserPosts() {
  console.log("=== Test 1: Fetching posts for a valid public TikTok user ===")
  try {
    const username = process.argv[2] || "tiktok"
    const limit = 5
    const result = await Tiktok.GetUserPosts(username, {
      postLimit: limit,
      proxy: undefined
    })

    if (result.status === "success" && result.result) {
      console.log("\nUser Posts fetched successfully!")
      console.log("========================")
      console.log(`Total posts fetched: ${result.result.length}`)
      console.log("========================")

      result.result.forEach((post, index) => {
        console.log(`\nPost ${index + 1}:`)
        console.log("-------------------")
        console.log(`ID: ${post.id}`)
        console.log(`Description: ${post.desc}`)
        if (post.author) {
          console.log(`Author: ${post.author.nickname} (@${post.author.username})`)
        }
        if (post.createTime) {
          console.log(`Created: ${new Date(post.createTime * 1000).toISOString()}`)
        }
        if (post.stats) {
          console.log("Statistics:")
          console.log(`- Plays: ${post.stats.playCount}`)
        }
        if (post.video?.playAddr) {
          console.log(`Video URL: ${post.video.playAddr}`)
        }
        console.log("========================")
      })

      if (result.result.length > limit) {
        console.error(`FAILED: result length ${result.result.length} exceeded limit ${limit}`)
        process.exitCode = 1
      }
    } else {
      console.error("FAILED to fetch posts:", result.message)
      process.exitCode = 1
    }
  } catch (error) {
    console.error("Test 1 failed with error:", error)
    process.exitCode = 1
  }

  console.log("\n=== Test 2: Error handling for a non-existent TikTok user ===")
  try {
    const fakeUser = "thisuserdoesnotexist_9988771122"
    const result = await Tiktok.GetUserPosts(fakeUser, { postLimit: 5 })
    if (result.status === "error" && result.message === "User not found!") {
      console.log(`PASS: Correctly returned error: ${result.message}`)
    } else {
      console.error(`FAILED: Expected 'User not found!' but received:`, result)
      process.exitCode = 1
    }
  } catch (error) {
    console.error("Test 2 failed with unexpected exception:", error)
    process.exitCode = 1
  }
}

testUserPosts()
