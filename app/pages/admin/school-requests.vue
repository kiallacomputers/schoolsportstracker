<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
await navigateTo('/admin/schools?tab=requests', { replace: true })
</script>
