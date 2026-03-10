<script lang="ts">
	import { T } from '@threlte/core';
</script>

<!-- Placeholder: same as MenuStage. Replaced entirely in Phase 3. -->
<T.AmbientLight intensity={0.4} />
<T.DirectionalLight position={[10, 20, 10]} intensity={0.8} />
<T.Mesh position={[0, -0.5, 0]}>
	<T.PlaneGeometry args={[200, 200]} />
	<T.MeshStandardMaterial color="#1a3a10" />
</T.Mesh>
