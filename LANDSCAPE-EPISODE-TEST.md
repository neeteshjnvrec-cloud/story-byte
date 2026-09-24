# Landscape episode test job

Run `Actions → Test Landscape Episode → Run workflow` on this branch.

The job writes only to `public/episodes/` and generates a 1920x1080, 30 FPS narrated episode. It does not call the existing daily/community pipelines, write Firestore, publish to social media, or deploy Firebase Hosting.
