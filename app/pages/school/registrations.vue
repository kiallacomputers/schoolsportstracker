<script setup lang="ts">
definePageMeta({layout:'workspace'})
const route=useRoute()
const initialCompetitionId=computed(()=>typeof route.query.competition==='string'?route.query.competition:'')
</script>
<template><CompetitionRegistrations :key="initialCompetitionId" :initial-competition-id="initialCompetitionId" /></template>
